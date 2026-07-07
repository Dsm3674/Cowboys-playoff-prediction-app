"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../databases");


const router = express.Router();



// ---------------------------------------------------------------------------
// The War Room — Pro-only prediction market + chatbot.
//
// Prediction market: parimutuel Star Coin markets on Cowboys/NFL outcomes.
// Every Pro member gets a wallet of Star Coins (virtual, no cash value).
// Stakes on YES/NO move the implied probability like Polymarket; when a
// market resolves, the winning side splits the whole pot pro-rata.
//
// Chatbot: answers Cowboys/analytics questions. Uses the Anthropic API when
// ANTHROPIC_API_KEY is set; otherwise falls back to a built-in responder so
// the feature works out of the box.
//
// Everything here is locked behind an active War Room Pro subscription
// (the $1/month Stripe plan) — checked against the subscriptions table that
// the Stripe webhook maintains, with a live Stripe lookup as fallback.
// ---------------------------------------------------------------------------
const STARTING_BALANCE = 1000;
const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecret ? require("stripe")(stripeSecret) : null;

// Chat engines, in order of preference:
//   1. Anthropic (ANTHROPIC_API_KEY) — Claude via the official SDK
//   2. OpenRouter (OPENROUTER_API_KEY, sk-or-v1-...) — free/cheap models
//      via the OpenAI-compatible endpoint
//   3. Built-in fallback responder (no key needed)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
let anthropicClient = null;
if (ANTHROPIC_API_KEY) {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  } catch (err) {
    console.error("[warroom] anthropic sdk unavailable:", err.message);
  }
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3-8b-instruct:free";
let openRouterClient = null;
if (OPENROUTER_API_KEY) {
  try {
    const { OpenAI } = require("openai");
    openRouterClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY
    });
  } catch (err) {
    console.error("[warroom] openai sdk unavailable:", err.message);
  }
}


// Comma-separated list of emails that get Pro without a subscription.
// The site owner always has access; PRO_FREE_EMAILS adds more accounts.
const OWNER_EMAIL = "divyanshusomasekhar1@gmail.com";
const PRO_FREE_EMAILS = new Set(
  [OWNER_EMAIL]
    .concat(String(process.env.PRO_FREE_EMAILS || "").split(","))
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Slow down — too many War Room requests." }
});
router.use(limiter);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(email);
}

function requestEmail(req) {
  const email = normalizeEmail(req.headers["x-lonestar-user"]);
  return isGmail(email) ? email : "";
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS wr_wallets (
      email VARCHAR(255) PRIMARY KEY,
      balance NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wr_markets (
      market_id SERIAL PRIMARY KEY,
      question VARCHAR(255) NOT NULL UNIQUE,
      detail VARCHAR(500),
      category VARCHAR(60) NOT NULL DEFAULT 'Cowboys',
      yes_pool NUMERIC(14,2) NOT NULL,
      no_pool NUMERIC(14,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      outcome VARCHAR(10),
      closes_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wr_positions (
      position_id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      market_id INTEGER NOT NULL REFERENCES wr_markets(market_id),
      side VARCHAR(5) NOT NULL,
      stake NUMERIC(12,2) NOT NULL,
      settled BOOLEAN NOT NULL DEFAULT FALSE,
      payout NUMERIC(12,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wr_positions_email ON wr_positions (email)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_wr_positions_market ON wr_positions (market_id)
  `);

  await seedMarkets();
  tablesReady = true;
}

// Seed pools are house liquidity sized so the opening price matches the
// Quantum Engine's model odds. House stakes don't belong to anyone; they
// stay in the pot and sweeten the payout for early bettors.
const SEED_MARKETS = [
  {
    question: "Cowboys make the 2026-27 NFL playoffs",
    detail: "Resolves YES if Dallas clinches any playoff berth this season.",
    category: "Cowboys",
    prob: 0.74
  },
  {
    question: "Cowboys win the NFC East",
    detail: "Resolves YES if Dallas finishes first in the division.",
    category: "Cowboys",
    prob: 0.41
  },
  {
    question: "Cowboys win 12 or more regular-season games",
    detail: "Resolves YES at 12-5 or better.",
    category: "Cowboys",
    prob: 0.28
  },
  {
    question: "Cowboys reach the Super Bowl",
    detail: "Resolves YES if Dallas wins the NFC Championship.",
    category: "Cowboys",
    prob: 0.094
  },
  {
    question: "An NFC East team reaches the Super Bowl",
    detail: "Resolves YES if DAL, PHI, NYG, or WAS wins the NFC.",
    category: "NFL",
    prob: 0.31
  },
  {
    question: "Dak Prescott throws 30+ touchdown passes",
    detail: "Regular season only, per official NFL stats.",
    category: "Players",
    prob: 0.45
  }
];

async function seedMarkets() {
  const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM wr_markets");
  if (rows[0].n > 0) return;
  const liquidity = 1000;
  for (const m of SEED_MARKETS) {
    const yes = Math.round(liquidity * m.prob * 100) / 100;
    const no = Math.round(liquidity * (1 - m.prob) * 100) / 100;
    await db.query(
      `
        INSERT INTO wr_markets (question, detail, category, yes_pool, no_pool)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (question) DO NOTHING
      `,
      [m.question, m.detail, m.category, yes, no]
    );
  }
}

// ---------------------------------------------------------------------------
// Pro gate
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const proCache = new Map(); // email -> { pro, expires }
const PRO_CACHE_MS = 5 * 60 * 1000;

async function hasDbSubscription(email) {
  try {
    const { rows } = await db.query(
      `SELECT status FROM subscriptions WHERE email = $1
       ORDER BY updated_at DESC LIMIT 5`,
      [email]
    );
    return rows.some((r) => ACTIVE_STATUSES.has(String(r.status)));
  } catch (_err) {
    return false; // subscriptions table may not exist yet
  }
}

// Fallback: ask Stripe directly, in case the webhook wasn't configured when
// the user subscribed. Any active subscription on a customer with this email
// counts.
async function hasStripeSubscription(email) {
  if (!stripe) return false;
  try {
    const customers = await stripe.customers.list({ email, limit: 5 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 5
      });
      if (subs.data.length > 0) return true;
    }
  } catch (err) {
    console.error("[warroom] stripe lookup failed:", err.message);
  }
  return false;
}

async function isPro(email) {
  if (!email) return false;
  if (PRO_FREE_EMAILS.has(email)) return true;

  const cached = proCache.get(email);
  if (cached && cached.expires > Date.now()) return cached.pro;

  let pro = await hasDbSubscription(email);
  if (!pro) pro = await hasStripeSubscription(email);

  proCache.set(email, { pro, expires: Date.now() + PRO_CACHE_MS });
  return pro;
}

async function requirePro(req, res, next) {
  try {
    const email = requestEmail(req);
    if (!email) {
      return res.status(401).json({
        error: "Sign in with your Gmail account to enter the War Room.",
        code: "signin_required"
      });
    }
    if (!(await isPro(email))) {
      return res.status(402).json({
        error: "The War Room is a Pro feature. Subscribe for $1/month to unlock it.",
        code: "pro_required",
        upgradeUrl: "/pro.html"
      });
    }
    req.warRoomEmail = email;
    next();
  } catch (error) {
    console.error("[warroom] pro gate failed:", error);
    res.status(500).json({ error: "Unable to verify Pro access right now." });
  }
}

// GET /api/warroom/status — public; the frontend uses it to decide whether to
// show the paywall or the live War Room.
router.get("/status", async (req, res) => {
  try {
    const email = requestEmail(req);
    const pro = email ? await isPro(email) : false;
    res.json({ signedIn: Boolean(email), email: email || null, pro });
  } catch (error) {
    console.error("[warroom] status failed:", error);
    res.status(500).json({ error: "Unable to check War Room status." });
  }
});

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

async function getWallet(email) {
  const { rows } = await db.query(
    `
      INSERT INTO wr_wallets (email, balance)
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING email, balance
    `,
    [email, STARTING_BALANCE]
  );
  return { email: rows[0].email, balance: Number(rows[0].balance) };
}

function marketView(row, positions = []) {
  const yes = Number(row.yes_pool);
  const no = Number(row.no_pool);
  const total = yes + no;
  return {
    id: row.market_id,
    question: row.question,
    detail: row.detail,
    category: row.category,
    status: row.status,
    outcome: row.outcome,
    yesPool: yes,
    noPool: no,
    yesPrice: total > 0 ? Math.round((yes / total) * 100) : 50,
    noPrice: total > 0 ? Math.round((no / total) * 100) : 50,
    myYesStake: positions
      .filter((p) => p.market_id === row.market_id && p.side === "yes" && !p.settled)
      .reduce((s, p) => s + Number(p.stake), 0),
    myNoStake: positions
      .filter((p) => p.market_id === row.market_id && p.side === "no" && !p.settled)
      .reduce((s, p) => s + Number(p.stake), 0)
  };
}

// ---------------------------------------------------------------------------
// Market endpoints (Pro only)
// ---------------------------------------------------------------------------

router.get("/markets", requirePro, async (req, res) => {
  try {
    await ensureTables();
    const wallet = await getWallet(req.warRoomEmail);
    const markets = await db.query(
      "SELECT * FROM wr_markets ORDER BY status = 'open' DESC, market_id"
    );
    const positions = await db.query(
      "SELECT * FROM wr_positions WHERE email = $1",
      [req.warRoomEmail]
    );
    res.json({
      wallet,
      markets: markets.rows.map((m) => marketView(m, positions.rows))
    });
  } catch (error) {
    console.error("[warroom] markets failed:", error);
    res.status(500).json({ error: "Unable to load markets." });
  }
});

router.post("/markets/:id/bet", requirePro, async (req, res) => {
  try {
    await ensureTables();
    const marketId = Number(req.params.id);
    const side = String(req.body.side || "").toLowerCase();
    const amount = Math.floor(Number(req.body.amount));

    if (!Number.isInteger(marketId) || marketId < 1) {
      return res.status(400).json({ error: "Unknown market." });
    }
    if (side !== "yes" && side !== "no") {
      return res.status(400).json({ error: "Pick YES or NO." });
    }
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ error: "Stake at least 1 Star Coin." });
    }
    if (amount > 10000) {
      return res.status(400).json({ error: "Max stake is 10,000 Star Coins per bet." });
    }

    const { rows: marketRows } = await db.query(
      "SELECT * FROM wr_markets WHERE market_id = $1",
      [marketId]
    );
    if (!marketRows[0]) return res.status(404).json({ error: "Unknown market." });
    if (marketRows[0].status !== "open") {
      return res.status(400).json({ error: "This market has closed." });
    }

    const wallet = await getWallet(req.warRoomEmail);
    if (wallet.balance < amount) {
      return res.status(400).json({
        error: `Not enough Star Coins — you have ${wallet.balance.toFixed(0)}.`
      });
    }

    // Debit only if the balance still covers the stake (guards concurrent bets).
    const debit = await db.query(
      `UPDATE wr_wallets SET balance = balance - $2, updated_at = CURRENT_TIMESTAMP
       WHERE email = $1 AND balance >= $2 RETURNING balance`,
      [req.warRoomEmail, amount]
    );
    if (!debit.rows[0]) {
      return res.status(400).json({ error: "Not enough Star Coins." });
    }

    const pool = side === "yes" ? "yes_pool" : "no_pool";
    await db.query(
      `UPDATE wr_markets SET ${pool} = ${pool} + $2 WHERE market_id = $1`,
      [marketId, amount]
    );
    await db.query(
      `INSERT INTO wr_positions (email, market_id, side, stake)
       VALUES ($1, $2, $3, $4)`,
      [req.warRoomEmail, marketId, side, amount]
    );

    const { rows: updated } = await db.query(
      "SELECT * FROM wr_markets WHERE market_id = $1",
      [marketId]
    );
    const positions = await db.query(
      "SELECT * FROM wr_positions WHERE email = $1",
      [req.warRoomEmail]
    );
    res.json({
      ok: true,
      balance: Number(debit.rows[0].balance),
      market: marketView(updated[0], positions.rows)
    });
  } catch (error) {
    console.error("[warroom] bet failed:", error);
    res.status(500).json({ error: "Unable to place that bet." });
  }
});

router.get("/leaderboard", requirePro, async (req, res) => {
  try {
    await ensureTables();
    const { rows } = await db.query(`
      SELECT w.email,
             w.balance::float AS balance,
             COALESCE(SUM(p.stake) FILTER (WHERE NOT p.settled), 0)::float AS at_risk
      FROM wr_wallets w
      LEFT JOIN wr_positions p ON p.email = w.email
      GROUP BY w.email, w.balance
      ORDER BY (w.balance + COALESCE(SUM(p.stake) FILTER (WHERE NOT p.settled), 0)) DESC
      LIMIT 10
    `);
    res.json({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        // Mask emails: keep first 3 chars of the local part.
        player: r.email.replace(/^(.{3})[^@]*@.*$/, "$1***"),
        you: r.email === req.warRoomEmail,
        netWorth: Math.round(r.balance + r.at_risk)
      }))
    });
  } catch (error) {
    console.error("[warroom] leaderboard failed:", error);
    res.status(500).json({ error: "Unable to load leaderboard." });
  }
});

// Resolve a market and pay out the pot — admin only (WARROOM_ADMIN_KEY).
router.post("/markets/:id/resolve", async (req, res) => {
  const adminKey = process.env.WARROOM_ADMIN_KEY || "";
  if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
    return res.status(403).json({ error: "Not allowed." });
  }
  try {
    await ensureTables();
    const marketId = Number(req.params.id);
    const outcome = String(req.body.outcome || "").toLowerCase();
    if (outcome !== "yes" && outcome !== "no") {
      return res.status(400).json({ error: "Outcome must be yes or no." });
    }

    const { rows: marketRows } = await db.query(
      "SELECT * FROM wr_markets WHERE market_id = $1 AND status = 'open'",
      [marketId]
    );
    if (!marketRows[0]) return res.status(404).json({ error: "No open market with that id." });

    const market = marketRows[0];
    const pot = Number(market.yes_pool) + Number(market.no_pool);
    const winningPool = Number(outcome === "yes" ? market.yes_pool : market.no_pool);

    const { rows: winners } = await db.query(
      `SELECT * FROM wr_positions
       WHERE market_id = $1 AND side = $2 AND NOT settled`,
      [marketId, outcome]
    );

    for (const p of winners) {
      const payout = winningPool > 0
        ? Math.round((Number(p.stake) / winningPool) * pot * 100) / 100
        : 0;
      await db.query(
        `UPDATE wr_wallets SET balance = balance + $2, updated_at = CURRENT_TIMESTAMP
         WHERE email = $1`,
        [p.email, payout]
      );
      await db.query(
        "UPDATE wr_positions SET settled = TRUE, payout = $2 WHERE position_id = $1",
        [p.position_id, payout]
      );
    }
    await db.query(
      `UPDATE wr_positions SET settled = TRUE, payout = 0
       WHERE market_id = $1 AND NOT settled`,
      [marketId]
    );
    await db.query(
      "UPDATE wr_markets SET status = 'resolved', outcome = $2 WHERE market_id = $1",
      [marketId, outcome]
    );

    res.json({ ok: true, resolved: marketId, outcome, paidOut: winners.length });
  } catch (error) {
    console.error("[warroom] resolve failed:", error);
    res.status(500).json({ error: "Unable to resolve market." });
  }
});

// ---------------------------------------------------------------------------
// Perfect Season game — pays Star Coins for a completed season.
// 5 coins per win, milestone bonuses at 5/10/15 wins (+25/+75/+200, stacking),
// +500 for a perfect 20-0. One reward per minute per user.
// ---------------------------------------------------------------------------

const seasonRewardAt = new Map(); // email -> last reward timestamp

const SEASON_MILESTONES = [
  [5, 25],
  [10, 75],
  [15, 200]
];

router.post("/season/reward", requirePro, async (req, res) => {
  try {
    await ensureTables();
    const wins = Math.floor(Number(req.body.wins));
    if (!Number.isFinite(wins) || wins < 0 || wins > 20) {
      return res.status(400).json({ error: "Invalid season result." });
    }

    const last = seasonRewardAt.get(req.warRoomEmail) || 0;
    if (Date.now() - last < 60 * 1000) {
      return res.status(429).json({
        error: "Take a breather, coach — one season reward per minute."
      });
    }
    seasonRewardAt.set(req.warRoomEmail, Date.now());

    const perfect = wins === 20;
    let reward = wins * 5 + (perfect ? 500 : 0);
    const milestones = SEASON_MILESTONES.filter(([need]) => wins >= need);
    for (const [, bonus] of milestones) reward += bonus;
    await getWallet(req.warRoomEmail);
    const { rows } = await db.query(
      `UPDATE wr_wallets SET balance = balance + $2, updated_at = CURRENT_TIMESTAMP
       WHERE email = $1 RETURNING balance`,
      [req.warRoomEmail, reward]
    );
    res.json({
      ok: true,
      reward,
      perfect,
      milestones: milestones.map(([need, bonus]) => ({ wins: need, bonus })),
      balance: Number(rows[0].balance)
    });
  } catch (error) {
    console.error("[warroom] season reward failed:", error);
    res.status(500).json({ error: "Unable to record the season." });
  }
});

// ---------------------------------------------------------------------------
// Chatbot (Pro only)
// ---------------------------------------------------------------------------

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "The analyst needs a breather — try again in a minute." }
});

async function marketContext() {
  try {
    await ensureTables();
    const { rows } = await db.query(
      "SELECT * FROM wr_markets WHERE status = 'open' ORDER BY market_id LIMIT 12"
    );
    return rows
      .map((m) => {
        const total = Number(m.yes_pool) + Number(m.no_pool);
        const yes = total > 0 ? Math.round((Number(m.yes_pool) / total) * 100) : 50;
        return `- ${m.question}: YES ${yes}¢ / NO ${100 - yes}¢`;
      })
      .join("\n");
  } catch (_err) {
    return "";
  }
}

function fallbackReply(text, markets) {
  const q = String(text || "").toLowerCase();
  if (/playoff|chance|odds|make it/.test(q)) {
    return (
      "The Quantum Engine currently has the Cowboys around 74% to make the playoffs, " +
      "and the crowd here agrees — check the 'Cowboys make the playoffs' market on the left. " +
      "The biggest swing factors are the remaining NFC East games."
    );
  }
  if (/super bowl/.test(q)) {
    return (
      "Dallas reaching the Super Bowl is priced as a long shot — the model has it under 10%. " +
      "If you believe, YES shares on that market are cheap right now."
    );
  }
  if (/bet|coin|market|price|share/.test(q)) {
    return (
      "Markets here work like Polymarket, but with Star Coins instead of cash: the YES price is the crowd's " +
      "probability in cents. Stake coins on a side; when the market resolves, the winning side splits the whole pot " +
      "pro-rata. Everyone starts with 1,000 Star Coins.\n\nCurrent board:\n" + (markets || "(no open markets)")
    );
  }
  if (/dak|prescott/.test(q)) {
    return (
      "Dak's 30+ TD market is sitting near a coin flip. His TD pace tracks the offensive line's " +
      "pass-block win rate more than anything — watch that stat on Sundays."
    );
  }
  return (
    "I'm the War Room analyst — ask me about Cowboys playoff odds, the prediction markets on this page, " +
    "or how the Quantum Engine model works. For the deepest answers, the site owner can connect the " +
    "Claude API (set ANTHROPIC_API_KEY) to give me my full brain."
  );
}

router.post("/chat", requirePro, chatLimiter, async (req, res) => {
  try {
    const incoming = Array.isArray(req.body.messages) ? req.body.messages : [];
    const history = incoming
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
      )
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }));

    if (!history.length || history[history.length - 1].role !== "user") {
      return res.status(400).json({ error: "Send a message to the analyst." });
    }

    const board = await marketContext();

    if (!anthropicClient && !openRouterClient) {
      return res.json({
        reply: fallbackReply(history[history.length - 1].content, board),
        engine: "builtin"
      });
    }

    const system =
      "You are the War Room Analyst for LoneStar AI (lstar.one), a Dallas Cowboys and NFL " +
      "playoff-prediction site. You chat with War Room Pro subscribers inside the Pro dashboard. " +
      "Be sharp, fun, and concise (under 150 words unless asked for depth). You know football " +
      "analytics: playoff odds, Elo, strength of schedule, win probability, tiebreakers. " +
      "The page you live on hosts a Star Coin prediction market (parimutuel, Polymarket-style, " +
      "virtual coins with no cash value — never call it gambling or give real-money betting advice).\n\n" +
      "Current market board (YES price in cents = crowd probability):\n" +
      (board || "(no open markets)");

    let reply = "";
    let engine = "";

    if (anthropicClient) {
      engine = "claude";
      const response = await anthropicClient.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: history
      });
      reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (response.stop_reason === "refusal") reply = "";
    } else {
      engine = "openrouter";
      const response = await openRouterClient.chat.completions.create({
        model: OPENROUTER_MODEL,
        max_tokens: 1024,
        messages: [{ role: "system", content: system }, ...history]
      });
      reply = String(response.choices?.[0]?.message?.content || "").trim();
    }

    if (!reply) {
      return res.json({
        reply: "I can't help with that one — try me on Cowboys odds or the markets.",
        engine
      });
    }

    res.json({ reply, engine });
  } catch (error) {
    console.error("[warroom] chat failed:", error);
    res.status(500).json({ error: "The analyst dropped the headset. Try again." });
  }
});

module.exports = router;

