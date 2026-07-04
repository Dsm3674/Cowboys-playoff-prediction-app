const express = require("express");
const rateLimit = require("express-rate-limit");
const fetch = require("node-fetch");
const db = require("../databases");

const router = express.Router();

// ---------------------------------------------------------------------------
// Stripe — War Room Pro subscriptions ($1/month)
// STRIPE_PRICE_ID_WAR_ROOM_PRO should point at a $1/month recurring price in
// the Stripe dashboard. If it's not set, checkout falls back to inline
// price_data at $1/month so the flow still works out of the box.
// ---------------------------------------------------------------------------
const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecret ? require("stripe")(stripeSecret) : null;
const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID_WAR_ROOM_PRO || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PRO_PRICE_USD_CENTS = 100; // $1/month

function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// Email notifications via Resend
// When a new access request lands, fire-and-forget an email to the team so
// they can follow up manually. Falls back silently if Resend isn't configured.
// ---------------------------------------------------------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFICATION_EMAIL_TO =
  process.env.NOTIFICATION_EMAIL_TO || "divyanshusomasekhar1@gmail.com";
const NOTIFICATION_EMAIL_FROM =
  process.env.NOTIFICATION_EMAIL_FROM || "LoneStar AI <onboarding@resend.dev>";

async function notifyAccessRequest(record) {
  if (!RESEND_API_KEY) return; // Not configured — skip silently.

  const subject = `[LoneStar AI] New ${record.plan} from ${record.email}`;
  const lines = [
    `Plan:    ${record.plan}`,
    `Email:   ${record.email}`,
    `Name:    ${record.name || "(not provided)"}`,
    `Price:   ${record.price}`,
    `When:    ${record.created_at || new Date().toISOString()}`,
    `ID:      ${record.request_id || "(unknown)"}`
  ];
  const text = lines.join("\n");
  const html =
    `<div style="font-family: -apple-system, system-ui, sans-serif; font-size: 14px; line-height: 1.6;">` +
    `<h2 style="margin: 0 0 16px;">New access request — ${escapeHtml(record.plan)}</h2>` +
    `<table style="border-collapse: collapse;">` +
    lines
      .map((line) => {
        const idx = line.indexOf(":");
        const label = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        return `<tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">${escapeHtml(label)}</td><td style="padding: 4px 0;"><strong>${escapeHtml(value)}</strong></td></tr>`;
      })
      .join("") +
    `</table>` +
    `<p style="margin-top: 20px;"><a href="mailto:${encodeURIComponent(record.email)}">Reply to ${escapeHtml(record.email)}</a></p>` +
    `</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: NOTIFICATION_EMAIL_FROM,
        to: [NOTIFICATION_EMAIL_TO],
        reply_to: record.email,
        subject,
        text,
        html
      })
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[billing] resend send failed:", res.status, body);
    }
  } catch (err) {
    console.error("[billing] resend send threw:", err.message);
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many access requests. Please wait a few minutes."
});

const PLAN_ALLOWLIST = new Set([
  "Educator pilot",
  "War Room Pro",
  "Investor inquiry"
]);

let tableReady = false;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(email);
}

let subscriptionsTableReady = false;

async function ensureSubscriptionsTable() {
  if (subscriptionsTableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      subscription_id VARCHAR(120) PRIMARY KEY,
      customer_id VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      plan VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL,
      current_period_end TIMESTAMP,
      raw JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_email
    ON subscriptions (email)
  `);
  subscriptionsTableReady = true;
}

async function ensureAccessRequestsTable() {
  if (tableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS access_requests (
      request_id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(120),
      plan VARCHAR(80) NOT NULL,
      price VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'requested',
      source VARCHAR(80) NOT NULL DEFAULT 'landing_page',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_access_requests_email_created
    ON access_requests (email, created_at DESC)
  `);

  tableReady = true;
}

router.post("/access-request", requestLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "").trim().slice(0, 120);
    const plan = String(req.body.plan || "").trim();
    const price = String(req.body.price || "").trim();

    if (!isGmail(email)) {
      return res.status(400).json({ error: "Use a Gmail address to request access." });
    }

    if (!PLAN_ALLOWLIST.has(plan)) {
      return res.status(400).json({ error: "Choose a valid LoneStar AI plan." });
    }

    if (!price || price.length > 40) {
      return res.status(400).json({ error: "Plan price is required." });
    }

    await ensureAccessRequestsTable();

    const result = await db.query(
      `
        INSERT INTO access_requests (email, name, plan, price, metadata)
        VALUES ($1, NULLIF($2, ''), $3, $4, $5)
        RETURNING request_id, email, plan, price, status, created_at
      `,
      [
        email,
        name,
        plan,
        price,
        {
          paymentMode: "stripe_checkout",
          storesCardData: false
        }
      ]
    );

    const saved = result.rows[0];

    // Fire-and-forget email notification — don't block the response on it.
    notifyAccessRequest({
      ...saved,
      name: name || null
    }).catch((err) => {
      console.error("[billing] notifyAccessRequest unhandled:", err.message);
    });

    return res.status(201).json({
      ok: true,
      request: saved,
      message: "Access request saved. No card data was collected or stored."
    });
  } catch (error) {
    console.error("[billing] access request failed:", error);
    return res.status(500).json({
      error: "Unable to save access request right now."
    });
  }
});

// Stripe Checkout — creates a hosted-checkout session for War Room Pro
// and returns the URL the client should redirect to.
router.post("/create-checkout-session", requestLimiter, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: "Payments are not configured. Set STRIPE_SECRET_KEY."
    });
  }

  const plan = String(req.body.plan || "War Room Pro").trim();
  if (plan !== "War Room Pro") {
    return res.status(400).json({ error: "Only War Room Pro is available for checkout." });
  }

  const email = normalizeEmail(req.body.email);
  const base = publicBaseUrl(req);

  const lineItem = PRO_PRICE_ID
    ? { price: PRO_PRICE_ID, quantity: 1 }
    : {
        price_data: {
          currency: "usd",
          unit_amount: PRO_PRICE_USD_CENTS,
          recurring: { interval: "month" },
          product_data: {
            name: "War Room Pro",
            description: "LoneStar AI · premium playoff modeling, saved scenarios, weekly intel drops."
          }
        },
        quantity: 1
      };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      customer_email: email || undefined,
      allow_promotion_codes: true,
      success_url: `${base}/pro-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pro.html?checkout=cancelled`,
      metadata: { plan }
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error("[billing] checkout session failed:", error);
    return res.status(500).json({ error: "Unable to start checkout." });
  }
});

// Stripe webhook — receives subscription lifecycle events. Mounted with raw
// body parsing in server.js so signature verification works.
router.post("/webhook", async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send("Webhook not configured");
  }

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[billing] webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await ensureSubscriptionsTable();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscription(sub, session.customer_details?.email || session.customer_email);
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;
      let email = null;
      try {
        const customer = await stripe.customers.retrieve(sub.customer);
        email = customer.email || null;
      } catch (_) {}
      await upsertSubscription(sub, email);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[billing] webhook handler failed:", error);
    return res.status(500).send("Webhook handler error");
  }
});

async function upsertSubscription(sub, email) {
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;
  await db.query(
    `
      INSERT INTO subscriptions
        (subscription_id, customer_id, email, plan, status, current_period_end, raw, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        email = COALESCE(EXCLUDED.email, subscriptions.email),
        raw = EXCLUDED.raw,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      sub.id,
      sub.customer,
      normalizeEmail(email),
      "War Room Pro",
      sub.status,
      periodEnd,
      sub
    ]
  );
}

module.exports = router;
