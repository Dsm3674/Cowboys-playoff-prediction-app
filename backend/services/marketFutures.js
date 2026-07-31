"use strict";

/**
 * marketFutures
 * Storage and retrieval of Super Bowl futures prices — the stored snapshot,
 * the admin write path, and the live pull from The Odds API.
 *
 * Split out of marketValidation so it depends on nothing but oddsMath. That
 * matters: ratingsEngine now seeds its preseason prior from the market, and
 * marketValidation depends on playoffPathEngine → ratingsEngine. Leaving the
 * futures IO inside marketValidation would have closed that loop into a
 * require cycle.
 */

const fs = require("fs");
const path = require("path");

const { americanToImplied, americanFromProb } = require("./oddsMath");

const FUTURES_FILE = path.join(__dirname, "..", "Data", "market_futures.json");

const DEFAULT_SNAPSHOT = {
  source: "book-consensus (DraftKings/Caesars tiers)",
  note: "Super Bowl LXI futures, mid-July 2026 consensus — refresh via POST /api/model/market-futures as lines move.",
  asOf: "2026-07-20",
  // American odds to win Super Bowl LXI.
  odds: {
    LAR: 600, BAL: 1000, BUF: 1000, SEA: 1100, PHI: 1400, KC: 1500,
    DET: 1500, GB: 1700, LAC: 1700, SF: 1700, DEN: 2000, HOU: 2000,
    JAX: 2000, NE: 2000, CHI: 2200, DAL: 2200, CIN: 3000, IND: 4000,
    TB: 4000, MIN: 4500, ATL: 6500, NYG: 6500, WAS: 6500, PIT: 7500,
    CAR: 9000, NO: 9000, LV: 12500, TEN: 12500, CLE: 15000, MIA: 25000,
    NYJ: 25000, ARI: 40000,
  },
};

function readFutures() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FUTURES_FILE, "utf8"));
    if (parsed && typeof parsed.odds === "object") return parsed;
  } catch (_err) { /* fall through to seed */ }
  return DEFAULT_SNAPSHOT;
}

/* ── Live odds (The Odds API) ──────────────────────────────────────────── */

const LIVE_ODDS_URL =
  "https://api.the-odds-api.com/v4/sports/americanfootball_nfl_super_bowl_winner/odds/";
const LIVE_ODDS_TTL_MS = 6 * 60 * 60 * 1000; // books shift, but 4 pulls/day is plenty
let _liveOddsCache = { ts: 0, snapshot: null };

/**
 * Pull current Super Bowl futures when ODDS_API_KEY is configured
 * (free tier at the-odds-api.com). Prices are averaged across every US
 * book on the implied-probability scale — a consensus line, not one shop.
 * Returns null on any failure so callers fall back to the stored snapshot.
 */
async function fetchLiveFutures() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  if (_liveOddsCache.snapshot && Date.now() - _liveOddsCache.ts < LIVE_ODDS_TTL_MS) {
    return _liveOddsCache.snapshot;
  }

  try {
    const fetch = require("node-fetch");
    const url = `${LIVE_ODDS_URL}?apiKey=${apiKey}&regions=us&markets=outrights&oddsFormat=american`;
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) return null;
    const events = await res.json();

    const { getNFLTeamCatalog } = require("./espn");
    const nameToAbbr = {};
    for (const t of getNFLTeamCatalog()) {
      nameToAbbr[String(t.displayName || "").toLowerCase()] = t.abbreviation;
    }

    const sums = {};
    const counts = {};
    for (const event of Array.isArray(events) ? events : []) {
      for (const book of event.bookmakers || []) {
        for (const market of book.markets || []) {
          if (market.key !== "outrights") continue;
          for (const outcome of market.outcomes || []) {
            const abbr = nameToAbbr[String(outcome.name || "").toLowerCase()];
            const p = americanToImplied(outcome.price);
            if (!abbr || p == null) continue;
            sums[abbr] = (sums[abbr] || 0) + p;
            counts[abbr] = (counts[abbr] || 0) + 1;
          }
        }
      }
    }

    const odds = {};
    for (const [abbr, sum] of Object.entries(sums)) {
      odds[abbr] = americanFromProb(sum / counts[abbr]);
    }
    if (Object.keys(odds).length < 8) return null; // partial feed — don't trust it

    const snapshot = {
      source: "the-odds-api (US book consensus)",
      asOf: new Date().toISOString().slice(0, 10),
      odds,
    };
    _liveOddsCache = { ts: Date.now(), snapshot };
    try {
      fs.mkdirSync(path.dirname(FUTURES_FILE), { recursive: true });
      fs.writeFileSync(FUTURES_FILE, JSON.stringify(snapshot, null, 2));
    } catch (_err) { /* persisting is best-effort */ }
    return snapshot;
  } catch (_err) {
    return null;
  }
}

/** Live odds when configured and reachable, stored snapshot otherwise. */
async function getFutures() {
  return (await fetchLiveFutures()) || readFutures();
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
  _liveOddsCache = { ts: 0, snapshot: null }; // an admin write beats a cached pull
  return snapshot;
}

/** How stale a snapshot is, in days. Null when it carries no usable date. */
function snapshotAgeDays(snapshot) {
  const ts = new Date(snapshot?.asOf || "").getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 86400000));
}

module.exports = {
  DEFAULT_SNAPSHOT,
  readFutures,
  getFutures,
  saveFutures,
  fetchLiveFutures,
  snapshotAgeDays,
};
