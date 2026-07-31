"use strict";

/**
 * marketValidation
 * Compares the simulator against sportsbook futures, and produces the blended
 * forecast that treats the market as a prior rather than only as a scoreboard.
 *
 * Sportsbook futures carry vig (implied probabilities sum well above 100%), so
 * raw prices can't be compared to model output directly. De-vigging now runs
 * through oddsMath with Shin's method by default instead of proportional
 * normalization — on a 32-way futures board, proportional leaves longshots
 * systematically overpriced because it assumes the margin is spread evenly
 * across outcomes, which is the one thing books demonstrably do not do.
 *
 * Odds live in Data/market_futures.json and are updated through the API
 * (POST /api/model/market-futures) as books move — the file ships with a
 * manual snapshot so the panel renders out of the box.
 */

const { simulatePlayoffPaths } = require("./playoffPathEngine");
const futuresStore = require("./marketFutures");
const {
  americanToImplied,
  americanFromProb,
  devig,
  poolForecasts,
  modelWeightForWeek,
  klDivergence,
  totalVariation,
} = require("./oddsMath");

const { readFutures, getFutures, saveFutures, snapshotAgeDays } = futuresStore;

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
 * Compare model SB win probabilities against de-vigged market futures, and
 * pool the two into a single forecast.
 *
 * Teams outside the model's projected playoff field get modelProb 0 — a real
 * divergence worth surfacing, not an error.
 *
 * On metrics: correlation is reported for continuity but it is a poor headline
 * for this question, because it is scale-invariant — a model returning exactly
 * twice the market everywhere still correlates 1.0. KL divergence and total
 * variation actually measure whether the two distributions agree, and are 0
 * only when they do.
 */
async function validateAgainstMarket({ year, iterations, method = "shin", blendWeight } = {}) {
  const [paths, futures] = await Promise.all([
    simulatePlayoffPaths({ year, iterations }),
    getFutures(),
  ]);

  const { probs: marketProbs, overround, z, k } = devig(futures.odds, { method });
  const modelByTeam = Object.fromEntries(paths.teams.map((t) => [t.code, t.winSBPct]));

  /* Model percentages are over the playoff field only; normalize to a
     distribution before comparing it with one. */
  const modelTotal = Object.values(modelByTeam).reduce((s, v) => s + v, 0) || 1;
  const modelProbs = Object.fromEntries(
    Object.entries(modelByTeam).map(([code, pct]) => [code, pct / modelTotal])
  );

  const weight = Number.isFinite(Number(blendWeight))
    ? Math.max(0, Math.min(1, Number(blendWeight)))
    : modelWeightForWeek(paths.lastCompletedWeek);
  const blended = poolForecasts(modelProbs, marketProbs, weight);

  const codes = new Set([...Object.keys(marketProbs), ...Object.keys(modelByTeam)]);
  const rows = [...codes]
    .map((code) => {
      const marketPct = Number(((marketProbs[code] || 0) * 100).toFixed(2));
      const modelPct = modelByTeam[code] ?? 0;
      return {
        code,
        modelPct,
        marketPct,
        blendedPct: Number(((blended[code] || 0) * 100).toFixed(2)),
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
    market: {
      source: futures.source,
      asOf: futures.asOf,
      ageDays: snapshotAgeDays(futures),
      overroundPct: overround,
      devigMethod: method,
      shinZ: z == null ? null : Number(z.toFixed(4)),
      powerK: k == null ? null : Number(k.toFixed(4)),
    },
    blend: {
      modelWeight: weight,
      marketWeight: Number((1 - weight).toFixed(3)),
      lastCompletedWeek: paths.lastCompletedWeek,
      rationale:
        "Logarithmic opinion pool. Preseason the market leads because Elo is a regressed "
        + "carryover blind to the offseason; the model's share grows with every completed week.",
    },
    summary: {
      klDivergenceBits: Number(klDivergence(modelProbs, marketProbs).toFixed(4)),
      totalVariation: Number(totalVariation(modelProbs, marketProbs).toFixed(4)),
      meanAbsEdgePts: meanAbsEdge,
      correlation: Number(pearson(xs, ys).toFixed(3)),
      largestDivergence: rows[0] || null,
    },
    rows,
  };
}

module.exports = {
  /* Re-exported so existing callers and tests keep working after the split. */
  americanToImplied,
  americanFromProb,
  devig,
  readFutures,
  getFutures,
  saveFutures,
  validateAgainstMarket,
};
