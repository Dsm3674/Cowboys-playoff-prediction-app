"use strict";

/**
 * oddsMath
 * Pure functions for turning sportsbook prices into probabilities, and for
 * scoring probability forecasts. No IO, no engine dependencies — everything
 * here is deterministic and unit-testable, which is why it lives apart from
 * marketValidation (that module reaches the network and the simulator).
 *
 * The important piece is de-vigging. A book's quoted prices imply
 * probabilities that sum to more than 1; the excess (the overround, or vig) is
 * the book's margin and has to come out before the numbers mean anything.
 * How you remove it matters far more on a 32-way futures market than on a
 * two-way moneyline:
 *
 *   proportional  Scale every price by the same factor. Simple and standard,
 *                 but it assumes the vig is spread evenly across outcomes,
 *                 which ignores favourite-longshot bias — books load extra
 *                 margin onto longshots because bettors overbet them. On a
 *                 32-team futures board that is exactly the wrong assumption,
 *                 and it leaves longshots systematically overpriced.
 *   power         Solve for k with p_i = π_i^k. Corrects longshot bias more
 *                 aggressively than Shin.
 *   shin          Hyun Song Shin's model: treats the vig as the book's
 *                 insurance against insider-informed money, solving for the
 *                 insider proportion z. The method normally used to pull a
 *                 sharp consensus out of a board.
 *
 * Shin is the default here because this app de-vigs a 32-way Super Bowl
 * futures market, the longshot-heavy case proportional handles worst. On the
 * shipped board (26% overround) the correction is large: proportional gives
 * Arizona 0.20% to win it all, Shin 0.05%, while the favourite climbs from
 * 11.34% to 12.32%.
 *
 * Worth noting against the usual summary of these methods, which says Shin
 * lands between proportional and power: that holds for a short board, but not
 * at the tail of a 32-way one, where Shin cuts extreme longshots harder than
 * power does. Measured, not assumed — see the de-vig tests.
 */

const EPS = 1e-12;

/* ── Conversions ───────────────────────────────────────────────────────── */

/** American odds → implied probability (vig still included). */
function americanToImplied(odds) {
  const o = Number(odds);
  if (!Number.isFinite(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : -o / (-o + 100);
}

/** Probability → American odds. Clamped so 0 and 1 don't produce infinities. */
function americanFromProb(p) {
  const prob = Math.max(0.0005, Math.min(0.9995, Number(p)));
  return prob >= 0.5
    ? Math.round((-100 * prob) / (1 - prob))
    : Math.round((100 * (1 - prob)) / prob);
}

/** Decimal (European) odds → implied probability. */
function decimalToImplied(odds) {
  const o = Number(odds);
  if (!Number.isFinite(o) || o <= 1) return null;
  return 1 / o;
}

/* ── De-vig methods ────────────────────────────────────────────────────── */

/**
 * Generic monotone root find. `f` must be decreasing across [lo, hi].
 * Bisection rather than a fixed-point iteration: slower to converge but it
 * cannot diverge, which matters on ragged real-world boards.
 */
function bisect(f, lo, hi, iterations = 80) {
  let a = lo;
  let b = hi;
  const fa = f(a);
  if (fa <= 0) return a;
  if (f(b) >= 0) return b;
  for (let i = 0; i < iterations; i++) {
    const mid = (a + b) / 2;
    if (f(mid) > 0) a = mid; else b = mid;
  }
  return (a + b) / 2;
}

function proportionalDevig(raw) {
  const total = raw.reduce((s, p) => s + p, 0);
  return total > 0 ? raw.map((p) => p / total) : raw.map(() => 0);
}

/** p_i = π_i^k, with k solved so the book sums to 1. */
function powerDevig(raw) {
  const sumAt = (k) => raw.reduce((s, p) => s + Math.pow(p, k), 0);
  const k = bisect((x) => sumAt(x) - 1, 0.2, 8);
  const out = raw.map((p) => Math.pow(p, k));
  const total = out.reduce((s, p) => s + p, 0);
  return { probs: out.map((p) => p / total), k };
}

/**
 * Shin's method. With Φ the booksum and z the insider proportion:
 *
 *   p_i = [ sqrt(z² + 4(1-z)·π_i²/Φ) - z ] / (2(1-z))
 *
 * z is chosen so the fair probabilities sum to 1. At z = 0 this reduces to
 * π_i/sqrt(Φ) (which oversums), and the sum falls monotonically in z, so a
 * bisection on z is safe.
 */
function shinDevig(raw) {
  const booksum = raw.reduce((s, p) => s + p, 0);
  if (booksum <= 1 + EPS) return { probs: proportionalDevig(raw), z: 0 };

  const fair = (z) => {
    if (z <= EPS) return raw.map((p) => p / Math.sqrt(booksum));
    const denom = 2 * (1 - z);
    if (denom <= EPS) return raw.map((p) => (p * p) / booksum);
    return raw.map((p) =>
      (Math.sqrt(z * z + 4 * (1 - z) * ((p * p) / booksum)) - z) / denom);
  };

  const z = bisect((x) => fair(x).reduce((s, p) => s + p, 0) - 1, 0, 0.999);
  const probs = fair(z);
  const total = probs.reduce((s, p) => s + p, 0);
  /* Renormalize away the last slivers of bisection error. */
  return { probs: total > 0 ? probs.map((p) => p / total) : probs, z };
}

/**
 * De-vig a map of TEAM → American odds.
 *
 * Returns fair probabilities summing to 1, the overround the book was
 * carrying, and whichever method-specific parameter was solved for (Shin's z
 * or the power exponent k) so callers can show their work.
 */
function devig(oddsMap, { method = "shin" } = {}) {
  const codes = [];
  const raw = [];
  for (const [team, odds] of Object.entries(oddsMap || {})) {
    const p = americanToImplied(odds);
    if (p == null) continue;
    codes.push(String(team).toUpperCase());
    raw.push(p);
  }

  if (!raw.length) return { probs: {}, overround: 0, method, z: null, k: null };

  const booksum = raw.reduce((s, p) => s + p, 0);
  const overround = Number(((booksum - 1) * 100).toFixed(1));

  let values;
  let z = null;
  let k = null;
  if (method === "proportional") {
    values = proportionalDevig(raw);
  } else if (method === "power") {
    ({ probs: values, k } = powerDevig(raw));
  } else {
    ({ probs: values, z } = shinDevig(raw));
  }

  const probs = {};
  codes.forEach((code, i) => { probs[code] = values[i]; });
  return { probs, overround, method, z, k };
}

/* ── Combining forecasts ───────────────────────────────────────────────── */

/**
 * Logarithmic opinion pool: p ∝ model^w · market^(1-w), renormalized.
 *
 * The multi-outcome analogue of blending in logit space — it keeps the result
 * a proper distribution, and unlike a plain weighted average it will not put
 * meaningful mass on an outcome that one of the two sources calls impossible.
 * w = 1 is pure model, w = 0 is pure market.
 */
function poolForecasts(modelProbs, marketProbs, weight = 0.5) {
  const w = Math.max(0, Math.min(1, Number(weight)));
  const codes = new Set([...Object.keys(modelProbs || {}), ...Object.keys(marketProbs || {})]);
  const FLOOR = 1e-6;

  const scores = {};
  let total = 0;
  for (const code of codes) {
    const m = Math.max(FLOOR, Number(modelProbs?.[code]) || 0);
    const k = Math.max(FLOOR, Number(marketProbs?.[code]) || 0);
    const v = Math.exp(w * Math.log(m) + (1 - w) * Math.log(k));
    scores[code] = v;
    total += v;
  }
  if (total <= 0) return {};
  for (const code of codes) scores[code] /= total;
  return scores;
}

/**
 * How much weight the model has earned by a given point in the season.
 *
 * Preseason, Elo is a regressed carryover that cannot see the offseason, while
 * the market has priced free agency, the draft and camp news — so the market
 * leads. Every completed week adds real evidence, and by mid-season the model
 * stands on its own.
 */
function modelWeightForWeek(lastCompletedWeek, { floor = 0.35, fullBy = 14 } = {}) {
  const week = Math.max(0, Number(lastCompletedWeek) || 0);
  const progress = Math.min(1, week / fullBy);
  return Number((floor + (1 - floor) * progress).toFixed(3));
}

/* ── Distribution comparison ───────────────────────────────────────────── */

/**
 * Kullback–Leibler divergence D(p ‖ q) in bits, over the union of outcomes.
 *
 * This replaces correlation as the headline agreement metric. Correlation is
 * scale-invariant, so a model reporting exactly double the market everywhere
 * scores a perfect 1.0 — useless for judging whether two probability
 * distributions actually agree. KL is 0 only when they match.
 */
function klDivergence(p, q) {
  const codes = new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
  const FLOOR = 1e-9;
  let sum = 0;
  for (const code of codes) {
    const pi = Math.max(FLOOR, Number(p?.[code]) || 0);
    const qi = Math.max(FLOOR, Number(q?.[code]) || 0);
    sum += pi * Math.log2(pi / qi);
  }
  return sum;
}

/** Total variation distance: ½Σ|p_i − q_i|. 0 = identical, 1 = disjoint. */
function totalVariation(p, q) {
  const codes = new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
  let sum = 0;
  for (const code of codes) {
    sum += Math.abs((Number(p?.[code]) || 0) - (Number(q?.[code]) || 0));
  }
  return sum / 2;
}

/* ── Proper scoring rules (for backtesting settled seasons) ────────────── */

/**
 * Multi-class Brier score: Σ(p_i − y_i)² over every outcome, where `winner`
 * is the code that actually happened. Lower is better, 0 is perfect. Proper,
 * unlike accuracy — it rewards being well-calibrated rather than confident.
 */
function brierScore(probs, winner) {
  const champ = String(winner || "").toUpperCase();
  let sum = 0;
  for (const [code, p] of Object.entries(probs || {})) {
    const y = code.toUpperCase() === champ ? 1 : 0;
    sum += ((Number(p) || 0) - y) ** 2;
  }
  return sum;
}

/** Negative log likelihood of the realised outcome. Lower is better. */
function logLoss(probs, winner) {
  const champ = String(winner || "").toUpperCase();
  const p = Number(probs?.[champ]) || 0;
  return -Math.log(Math.max(1e-12, p));
}

/**
 * Reliability table: bucket forecasts by predicted probability and compare the
 * bucket's mean forecast against how often those events actually happened.
 * `samples` is [{ prob, outcome }] with outcome 0 or 1.
 */
function calibrationBuckets(samples, bucketCount = 10) {
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    from: i / bucketCount,
    to: (i + 1) / bucketCount,
    n: 0,
    sumProb: 0,
    hits: 0,
  }));

  for (const s of samples || []) {
    const p = Number(s?.prob);
    if (!Number.isFinite(p)) continue;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(p * bucketCount)));
    buckets[idx].n++;
    buckets[idx].sumProb += p;
    buckets[idx].hits += Number(s?.outcome) ? 1 : 0;
  }

  return buckets
    .filter((b) => b.n > 0)
    .map((b) => ({
      from: b.from,
      to: b.to,
      n: b.n,
      predicted: Number((b.sumProb / b.n).toFixed(4)),
      observed: Number((b.hits / b.n).toFixed(4)),
    }));
}

module.exports = {
  americanToImplied,
  americanFromProb,
  decimalToImplied,
  devig,
  shinDevig,
  powerDevig,
  proportionalDevig,
  poolForecasts,
  modelWeightForWeek,
  klDivergence,
  totalVariation,
  brierScore,
  logLoss,
  calibrationBuckets,
};
