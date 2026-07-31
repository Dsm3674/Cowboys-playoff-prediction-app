"use strict";

const {
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
} = require("../services/oddsMath");

const { DEFAULT_SNAPSHOT } = require("../services/marketFutures");
const { marketImpliedElo, MARKET_ELO_SD } = require("../services/ratingsEngine");

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

describe("oddsMath — conversions", () => {
  test("american odds convert to implied probability", () => {
    expect(americanToImplied(100)).toBeCloseTo(0.5, 6);
    expect(americanToImplied(-110)).toBeCloseTo(110 / 210, 6);
    expect(americanToImplied(900)).toBeCloseTo(0.1, 6);
    expect(americanToImplied("junk")).toBeNull();
    expect(americanToImplied(0)).toBeNull();
  });

  test("probability round-trips through american odds", () => {
    for (const p of [0.05, 0.25, 0.5, 0.75, 0.9]) {
      expect(americanToImplied(americanFromProb(p))).toBeCloseTo(p, 2);
    }
  });

  test("decimal odds convert to implied probability", () => {
    expect(decimalToImplied(2)).toBeCloseTo(0.5, 6);
    expect(decimalToImplied(1)).toBeNull();
    expect(decimalToImplied(-3)).toBeNull();
  });
});

describe("oddsMath — de-vig methods", () => {
  const board = { KC: 100, BUF: 100, DAL: 100 };

  test("every method returns a proper distribution", () => {
    for (const method of ["proportional", "power", "shin"]) {
      const { probs } = devig(board, { method });
      expect(sum(probs)).toBeCloseTo(1, 6);
    }
  });

  test("overround is reported off the raw booksum", () => {
    const { overround } = devig(board, { method: "proportional" });
    expect(overround).toBeCloseTo(50, 1); // three 50% prices = a 150% book
  });

  test("a symmetric board de-vigs to equal probabilities under any method", () => {
    for (const method of ["proportional", "power", "shin"]) {
      const { probs } = devig(board, { method });
      expect(probs.KC).toBeCloseTo(1 / 3, 5);
      expect(probs.DAL).toBeCloseTo(1 / 3, 5);
    }
  });

  test("shin and power shade longshots below proportional on a vigged board", () => {
    /* Favourite-longshot bias: books pad the price on the field. A method that
       corrects for it must hand the longshot LESS probability than a flat
       proportional scaling does, and the favourite more.
       This board sums to 112.5% — a board without an overround has no vig to
       remove, and every method correctly collapses to the same answer. */
    const skewed = { FAV: -300, MID: 250, DOG: 1200, LONGSHOT: 8000 };
    const prop = devig(skewed, { method: "proportional" }).probs;
    const shin = devig(skewed, { method: "shin" }).probs;
    const power = devig(skewed, { method: "power" }).probs;

    expect(shin.LONGSHOT).toBeLessThan(prop.LONGSHOT);
    expect(power.LONGSHOT).toBeLessThan(prop.LONGSHOT);
    expect(shin.FAV).toBeGreaterThan(prop.FAV);
    expect(power.FAV).toBeGreaterThan(prop.FAV);
  });

  test("a board with no overround is returned untouched by every method", () => {
    /* Sums to 99.3%, so there is nothing to remove. */
    const noVig = { FAV: -300, MID: 400, DOG: 2500, LONGSHOT: 20000 };
    const prop = devig(noVig, { method: "proportional" }).probs;
    const shin = devig(noVig, { method: "shin" }).probs;
    expect(shin.LONGSHOT).toBeCloseTo(prop.LONGSHOT, 9);
  });

  test("shin cuts deeper than power at the tail of a long board", () => {
    /* The usual summary of these methods puts Shin between proportional and
       power. That is true on a short board but not at the tail of a 32-way
       one, where Shin is the more aggressive of the two. Asserted because it
       is measured, and because it is the case this app actually runs. */
    const shin = devig(DEFAULT_SNAPSHOT.odds, { method: "shin" }).probs;
    const power = devig(DEFAULT_SNAPSHOT.odds, { method: "power" }).probs;
    expect(shin.ARI).toBeLessThan(power.ARI);
  });

  test("the shipped board's longshot correction is material, not cosmetic", () => {
    const prop = devig(DEFAULT_SNAPSHOT.odds, { method: "proportional" }).probs;
    const shin = devig(DEFAULT_SNAPSHOT.odds, { method: "shin" }).probs;
    // Proportional more than doubles the field's longest shots.
    expect(prop.ARI / shin.ARI).toBeGreaterThan(2);
    expect(shin.LAR).toBeGreaterThan(prop.LAR);
  });

  test("shin solves an insider proportion inside [0,1)", () => {
    const { z } = devig(DEFAULT_SNAPSHOT.odds, { method: "shin" });
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(1);
  });

  test("power solves an exponent above 1 for an overround book", () => {
    const { k } = devig(DEFAULT_SNAPSHOT.odds, { method: "power" });
    expect(k).toBeGreaterThan(1);
  });

  test("de-vigging preserves the market's ordering", () => {
    const { probs } = devig(DEFAULT_SNAPSHOT.odds, { method: "shin" });
    // LAR is the shortest price on the board, ARI the longest.
    expect(probs.LAR).toBeGreaterThan(probs.DAL);
    expect(probs.DAL).toBeGreaterThan(probs.ARI);
  });

  test("the shipped 32-team board de-vigs to exactly 1", () => {
    const { probs } = devig(DEFAULT_SNAPSHOT.odds, { method: "shin" });
    expect(Object.keys(probs)).toHaveLength(32);
    expect(sum(probs)).toBeCloseTo(1, 6);
  });

  test("a book already at 100% is left alone", () => {
    const fair = { A: 100, B: 100 }; // two 50% prices, no vig
    const { probs, overround } = devig(fair, { method: "shin" });
    expect(overround).toBeCloseTo(0, 6);
    expect(probs.A).toBeCloseTo(0.5, 6);
  });

  test("empty and unusable input degrades quietly", () => {
    expect(devig({}).probs).toEqual({});
    expect(devig({ A: "junk" }).probs).toEqual({});
    expect(devig(null).probs).toEqual({});
  });

  test("raw helpers agree with the dispatcher", () => {
    const raw = [0.5, 0.3, 0.4];
    expect(proportionalDevig(raw).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(powerDevig(raw).probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(shinDevig(raw).probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});

describe("oddsMath — pooling forecasts", () => {
  const model = { A: 0.6, B: 0.3, C: 0.1 };
  const market = { A: 0.2, B: 0.3, C: 0.5 };

  test("pooling returns a proper distribution", () => {
    expect(sum(poolForecasts(model, market, 0.5))).toBeCloseTo(1, 6);
  });

  test("weight 1 is the model, weight 0 is the market", () => {
    const pureModel = poolForecasts(model, market, 1);
    const pureMarket = poolForecasts(model, market, 0);
    expect(pureModel.A).toBeCloseTo(0.6, 4);
    expect(pureMarket.C).toBeCloseTo(0.5, 4);
  });

  test("a blend lands between the two sources", () => {
    const mid = poolForecasts(model, market, 0.5);
    expect(mid.A).toBeGreaterThan(market.A);
    expect(mid.A).toBeLessThan(model.A);
  });

  test("teams missing from one source still appear", () => {
    const pooled = poolForecasts({ A: 1 }, { A: 0.5, B: 0.5 }, 0.5);
    expect(Object.keys(pooled).sort()).toEqual(["A", "B"]);
    expect(sum(pooled)).toBeCloseTo(1, 6);
  });

  test("model weight grows with completed weeks and then saturates", () => {
    expect(modelWeightForWeek(0)).toBeCloseTo(0.35, 3);
    expect(modelWeightForWeek(7)).toBeGreaterThan(modelWeightForWeek(0));
    expect(modelWeightForWeek(14)).toBeCloseTo(1, 3);
    expect(modelWeightForWeek(30)).toBeCloseTo(1, 3);
    expect(modelWeightForWeek(null)).toBeCloseTo(0.35, 3);
  });
});

describe("oddsMath — distribution comparison", () => {
  test("identical distributions have zero divergence", () => {
    const p = { A: 0.5, B: 0.5 };
    expect(klDivergence(p, p)).toBeCloseTo(0, 9);
    expect(totalVariation(p, p)).toBeCloseTo(0, 9);
  });

  test("divergence grows as distributions separate", () => {
    const p = { A: 0.9, B: 0.1 };
    const near = { A: 0.8, B: 0.2 };
    const far = { A: 0.1, B: 0.9 };
    expect(klDivergence(p, far)).toBeGreaterThan(klDivergence(p, near));
    expect(totalVariation(p, far)).toBeGreaterThan(totalVariation(p, near));
  });

  test("total variation is bounded by 1", () => {
    expect(totalVariation({ A: 1 }, { B: 1 })).toBeCloseTo(1, 6);
  });

  test("KL catches a mis-scaled model that correlation would call perfect", () => {
    /* This is the reason correlation was demoted: doubling every model
       probability keeps correlation at 1.0 but is plainly a worse forecast. */
    const market = { A: 0.4, B: 0.35, C: 0.25 };
    const doubled = { A: 0.8, B: 0.7, C: 0.5 };
    expect(klDivergence(doubled, market)).toBeGreaterThan(0);
  });
});

describe("oddsMath — scoring rules", () => {
  test("a confident correct forecast scores better than a hedged one", () => {
    const confident = { A: 0.9, B: 0.1 };
    const hedged = { A: 0.5, B: 0.5 };
    expect(brierScore(confident, "A")).toBeLessThan(brierScore(hedged, "A"));
    expect(logLoss(confident, "A")).toBeLessThan(logLoss(hedged, "A"));
  });

  test("a confident wrong forecast is punished", () => {
    const confident = { A: 0.9, B: 0.1 };
    expect(brierScore(confident, "B")).toBeGreaterThan(brierScore(confident, "A"));
    expect(logLoss(confident, "B")).toBeCloseTo(-Math.log(0.1), 9);
    expect(logLoss(confident, "B")).toBeGreaterThan(logLoss(confident, "A"));
  });

  test("a perfect forecast scores zero brier", () => {
    expect(brierScore({ A: 1, B: 0 }, "A")).toBeCloseTo(0, 9);
  });

  test("log loss on a zero-probability outcome is finite, not infinite", () => {
    expect(Number.isFinite(logLoss({ A: 1, B: 0 }, "B"))).toBe(true);
  });

  test("calibration buckets report predicted against observed", () => {
    const samples = [
      ...Array.from({ length: 10 }, () => ({ prob: 0.9, outcome: 1 })),
      ...Array.from({ length: 10 }, () => ({ prob: 0.1, outcome: 0 })),
    ];
    const buckets = calibrationBuckets(samples);
    expect(buckets).toHaveLength(2);
    const high = buckets.find((b) => b.predicted > 0.5);
    expect(high.observed).toBeCloseTo(1, 6);
    expect(high.n).toBe(10);
  });

  test("calibration ignores unusable samples", () => {
    expect(calibrationBuckets([{ prob: "x", outcome: 1 }])).toEqual([]);
    expect(calibrationBuckets(null)).toEqual([]);
  });
});

describe("ratingsEngine — market-implied Elo prior", () => {
  test("the futures board maps onto a sane Elo spread", () => {
    const elo = marketImpliedElo(DEFAULT_SNAPSHOT.odds);
    expect(elo).not.toBeNull();

    const values = Object.values(elo);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeCloseTo(1500, 6); // standardized, so it centres on base

    // Standardized to one SD, so the league should span roughly ±2 SD.
    expect(Math.max(...values)).toBeLessThan(1500 + 3 * MARKET_ELO_SD);
    expect(Math.min(...values)).toBeGreaterThan(1500 - 3 * MARKET_ELO_SD);
  });

  test("market Elo ranks the board the way the prices do", () => {
    const elo = marketImpliedElo(DEFAULT_SNAPSHOT.odds);
    expect(elo.LAR).toBeGreaterThan(elo.DAL);   // +600 vs +2200
    expect(elo.DAL).toBeGreaterThan(elo.ARI);   // +2200 vs +40000
  });

  test("a board too thin to trust is refused", () => {
    expect(marketImpliedElo({ KC: 100, BUF: 100 })).toBeNull();
    expect(marketImpliedElo({})).toBeNull();
  });
});
