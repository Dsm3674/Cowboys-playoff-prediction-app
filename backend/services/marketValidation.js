"use strict";

/**
 * marketValidation
 * Sanity-checks the model against Super Bowl futures markets.
 *
 * Sportsbook futures carry vig (implied probabilities sum well above 100%),
 * so raw odds can't be compared to model output directly. We convert American
 * odds to implied probabilities and de-vig by proportional normalization,
 * then report per-team edge and aggregate agreement metrics.
 *
 * Odds live in Data/market_futures.json and are updated through the API
 * (POST /api/model/market-futures) as books move — the file ships with a
 * manual snapshot so the panel renders out of the box.
 */

const fs = require("fs");
const path = require("path");

const { simulatePlayoffPaths } = require("./playoffPathEngine");

const FUTURES_FILE = path.join(__dirname, "..", "Data", "market_futures.json");

const DEFAULT_SNAPSHOT = {
  source: "manual-snapshot",
  note: "Seed data — update via POST /api/model/market-futures with live book odds.",
  asOf: "2026-07-01",
  // American odds to win the Super Bowl.
  odds: {
    KC: 600, BUF: 700, BAL: 750, SF: 800, DET: 850, PHI: 900, DAL: 1100,
    CIN: 1400, GB: 1500, LAR: 1800, MIA: 2200, NYJ: 2500, HOU: 2500,
    LAC: 3000, JAX: 3500, CLE: 4000, PIT: 4000, MIN: 4500, ATL: 5000,
    SEA: 5000, CHI: 5500, IND: 6000, TB: 6000, NO: 7000, DEN: 7000,
    LV: 8000, TEN: 10000, ARI: 10000, NYG: 10000, WAS: 12000, NE: 15000,
    CAR: 20000,
  },
};

function americanToImplied(odds) {
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : -o / (-o + 100);
}

/** Proportionally normalize implied probabilities so they sum to 1. */
function devig(oddsMap) {
  const implied = {};
  let total = 0;
  for (const [team, odds] of Object.entries(oddsMap || {})) {
    const p = americanToImplied(odds);
    if (p == null) continue;
    implied[team.toUpperCase()] = p;
    total += p;
  }
  if (total <= 0) return { probs: {}, overround: 0 };

  const probs = {};
  for (const [team, p] of Object.entries(implied)) probs[team] = p / total;
  return { probs, overround: Number(((total - 1) * 100).toFixed(1)) };
}

function readFutures() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FUTURES_FILE, "utf8"));
    if (parsed && typeof parsed.odds === "object") return parsed;
  } catch (_err) { /* fall through to seed */ }
  return DEFAULT_SNAPSHOT;
}

function saveFutures({ odds, source, asOf } = {}) {
  if (!odds || typeof odds !== "object" || Array.isArray(odds)) {
    throw new Error("Body must include an `odds` object of TEAM: americanOdds.");
  }
  const clean = {};
  for (const [team, value] of Object.entries(odds)) {
    const abbr = String(team).toUpperCase().trim();
    if (!/^[A-Z]{2,4}$/.test(abbr)) continue;
    if (americanToImplied(value) == null) continue;
    clean[abbr] = Number(value);
  }
  if (Object.keys(clean).length < 2) throw new Error("Need odds for at least two teams.");

  const snapshot = {
    source: String(source || "api-update").slice(0, 80),
    asOf: String(asOf || new Date().toISOString().slice(0, 10)),
    odds: clean,
  };
  fs.mkdirSync(path.dirname(FUTURES_FILE), { recursive: true });
  fs.writeFileSync(FUTURES_FILE, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/**
 * Compare model SB win probabilities against de-vigged market futures.
 * Teams outside the model's projected playoff field get modelProb 0 — a
 * real divergence worth surfacing, not an error.
 */
async function validateAgainstMarket({ year, iterations } = {}) {
  const [paths, futures] = await Promise.all([
    simulatePlayoffPaths({ year, iterations }),
    Promise.resolve(readFutures()),
  ]);

  const { probs: marketProbs, overround } = devig(futures.odds);
  const modelByTeam = Object.fromEntries(paths.teams.map((t) => [t.code, t.winSBPct]));

  const rows = Object.entries(marketProbs)
    .map(([code, marketP]) => {
      const marketPct = Number((marketP * 100).toFixed(2));
      const modelPct = modelByTeam[code] ?? 0;
      return {
        code,
        modelPct,
        marketPct,
        edgePts: Number((modelPct - marketPct).toFixed(2)),
        inModelField: code in modelByTeam,
      };
    })
    .sort((a, b) => Math.abs(b.edgePts) - Math.abs(a.edgePts));

  const xs = rows.map((r) => r.modelPct);
  const ys = rows.map((r) => r.marketPct);
  const meanAbsEdge = rows.length
    ? Number((rows.reduce((s, r) => s + Math.abs(r.edgePts), 0) / rows.length).toFixed(2))
    : 0;

  return {
    year: paths.year,
    iterations: paths.iterations,
    market: { source: futures.source, asOf: futures.asOf, overroundPct: overround },
    summary: {
      correlation: Number(pearson(xs, ys).toFixed(3)),
      meanAbsEdgePts: meanAbsEdge,
      largestDivergence: rows[0] || null,
    },
    rows,
  };
}

module.exports = {
  americanToImplied,
  devig,
  readFutures,
  saveFutures,
  validateAgainstMarket,
};
