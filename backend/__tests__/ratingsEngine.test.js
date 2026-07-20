"use strict";

const {
  eloWinProb,
  movMultiplier,
  replayGamesToElo,
  blendWithElo,
  ELO_BASE,
  ELO_HOME_FIELD,
} = require("../services/ratingsEngine");

const {
  simulatePlayoffPaths,
  seedConference,
  _internals,
} = require("../services/playoffPathEngine");

const { americanToImplied, americanFromProb, devig } = require("../services/marketValidation");

describe("ratingsEngine — Elo math", () => {
  test("even matchup on neutral field is a coin flip", () => {
    expect(eloWinProb(1500, 1500, 0)).toBeCloseTo(0.5, 6);
  });

  test("home field pushes an even matchup above 50%", () => {
    const p = eloWinProb(1500, 1500, ELO_HOME_FIELD);
    expect(p).toBeGreaterThan(0.55);
    expect(p).toBeLessThan(0.62);
  });

  test("probabilities are complementary", () => {
    const pA = eloWinProb(1650, 1480, 0);
    const pB = eloWinProb(1480, 1650, 0);
    expect(pA + pB).toBeCloseTo(1, 6);
  });

  test("MOV multiplier grows with margin and shrinks for favorites", () => {
    expect(movMultiplier(21, 0)).toBeGreaterThan(movMultiplier(3, 0));
    // A big favorite winning gets less credit than an underdog winning.
    expect(movMultiplier(7, 200)).toBeLessThan(movMultiplier(7, -200));
  });

  test("replay transfers points winner-ward and is zero-sum", () => {
    const games = [
      {
        id: "g1", date: "2026-09-10", completed: true,
        homeTeamAbbr: "DAL", awayTeamAbbr: "PHI", homeScore: 30, awayScore: 13,
      },
    ];
    const { elo } = replayGamesToElo(games);
    expect(elo.DAL).toBeGreaterThan(ELO_BASE);
    expect(elo.PHI).toBeLessThan(ELO_BASE);
    expect(elo.DAL + elo.PHI).toBeCloseTo(2 * ELO_BASE, 6);
  });

  test("replay starts from a supplied preseason prior", () => {
    const games = [
      { id: "g1", date: "2026-09-10", completed: true, homeTeamAbbr: "DAL", awayTeamAbbr: "PHI", homeScore: 24, awayScore: 20 },
    ];
    const { elo } = replayGamesToElo(games, { DAL: 1580, PHI: 1620 });
    expect(elo.DAL).toBeGreaterThan(1580);
    expect(elo.PHI).toBeLessThan(1620);
    expect(elo.DAL + elo.PHI).toBeCloseTo(1580 + 1620, 6);
  });

  test("replay ignores unfinished games and sorts by date", () => {
    const games = [
      { id: "g2", date: "2026-09-20", completed: false, homeTeamAbbr: "DAL", awayTeamAbbr: "NYG", homeScore: 0, awayScore: 0 },
      { id: "g1", date: "2026-09-10", completed: true, homeTeamAbbr: "DAL", awayTeamAbbr: "PHI", homeScore: 20, awayScore: 27 },
    ];
    const { ratedGames } = replayGamesToElo(games);
    expect(ratedGames).toHaveLength(1);
    expect(ratedGames[0].id).toBe("g1");
  });
});

describe("ratingsEngine — hybrid blend", () => {
  test("weight 0 keeps the legacy probability, weight 1 goes full Elo", () => {
    expect(blendWithElo(0.7, 0.3, 0)).toBeCloseTo(0.7, 6);
    expect(blendWithElo(0.7, 0.3, 1)).toBeCloseTo(0.3, 6);
  });

  test("even blend lands between the two model reads", () => {
    const mixed = blendWithElo(0.6, 0.8, 0.5);
    expect(mixed).toBeGreaterThan(0.6);
    expect(mixed).toBeLessThan(0.8);
  });

  test("agreeing models pass through, missing Elo falls back to base", () => {
    expect(blendWithElo(0.5, 0.5, 0.5)).toBeCloseTo(0.5, 6);
    expect(blendWithElo(0.66, NaN, 0.5)).toBe(0.66);
    expect(blendWithElo(0.66, undefined, 0.5)).toBe(0.66);
  });
});

/* Synthetic 32-team league for simulator tests. */
function syntheticRatings() {
  const confs = { AFC: ["East", "North", "South", "West"], NFC: ["East", "North", "South", "West"] };
  const ratings = [];
  let power = 1700;
  for (const [conference, divisions] of Object.entries(confs)) {
    for (const division of divisions) {
      for (let i = 0; i < 4; i++) {
        const code = `${conference[0]}${division[0]}${i}`;
        ratings.push({
          code, name: code, conference, division: `${conference} ${division}`,
          record: { winPct: power / 2000, wins: 10, losses: 7, ties: 0 },
          pointDiffPerGame: (power - 1500) / 25,
          power,
        });
        power -= 12;
      }
    }
  }
  // Make DAL a mid-tier NFC team so focus paths are non-trivial.
  const dal = ratings.find((t) => t.conference === "NFC");
  dal.code = "DAL";
  dal.name = "DAL";
  return { year: 2026, updatedAt: "test", lastCompletedWeek: 18, ratings };
}

describe("playoffPathEngine", () => {
  test("seeds seven teams per conference, division winners first", () => {
    const rows = syntheticRatings().ratings.filter((t) => t.conference === "AFC");
    const seeds = seedConference(rows);
    expect(seeds).toHaveLength(7);
    const divisionsInTop4 = new Set(seeds.slice(0, 4).map((t) => t.division));
    expect(divisionsInTop4.size).toBe(4);
    expect(seeds.map((t) => t.seed)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("simulation is deterministic under a seed and probabilities are coherent", async () => {
    const ratingsOverride = syntheticRatings();
    const run = () =>
      simulatePlayoffPaths({ focusTeam: "DAL", iterations: 4000, seed: 42, ratingsOverride });

    const [a, b] = await Promise.all([run(), run()]);
    expect(a.teams).toEqual(b.teams);

    const totalSBWin = a.teams.reduce((s, t) => s + t.winSBPct, 0);
    expect(totalSBWin).toBeGreaterThan(99);
    expect(totalSBWin).toBeLessThan(101);

    for (const t of a.teams) {
      expect(t.winSBPct).toBeLessThanOrEqual(t.reachSBPct);
      expect(t.reachSBPct).toBeLessThanOrEqual(t.reachCCPct);
    }
  });

  test("upset conditionals lift the field when the opposite #1 seed falls", async () => {
    const out = await simulatePlayoffPaths({
      focusTeam: "DAL", iterations: 8000, seed: 7, ratingsOverride: syntheticRatings(),
    });

    // The opposite conference's top seed missing the SB removes the most
    // likely SB opponent, so the average lift across the field is positive.
    const lifts = out.teams.map((t) => t.upsetLiftPts);
    const meanLift = lifts.reduce((a, b) => a + b, 0) / lifts.length;
    expect(meanLift).toBeGreaterThan(0);

    // Focus bookkeeping adds up.
    const exits = out.focusRoundExits;
    const total = Object.values(exits).reduce((a, b) => a + b, 0);
    expect(total).toBe(out.iterations);
  });

  test("iteration bounds are clamped", () => {
    expect(_internals.clampIterations(50)).toBe(1000);
    expect(_internals.clampIterations(10_000_000)).toBe(100000);
    expect(_internals.clampIterations(undefined)).toBe(25000);
  });
});

describe("marketValidation — odds math", () => {
  test("american odds convert to implied probability", () => {
    expect(americanToImplied(100)).toBeCloseTo(0.5, 6);
    expect(americanToImplied(-110)).toBeCloseTo(110 / 210, 6);
    expect(americanToImplied(900)).toBeCloseTo(0.1, 6);
    expect(americanToImplied("junk")).toBeNull();
  });

  test("probability round-trips through american odds", () => {
    for (const p of [0.05, 0.25, 0.5, 0.75, 0.9]) {
      expect(americanToImplied(americanFromProb(p))).toBeCloseTo(p, 2);
    }
    expect(americanFromProb(0.5)).toBe(-100);
    expect(americanFromProb(0.1)).toBe(900);
  });

  test("devig normalizes to a proper distribution and reports overround", () => {
    const { probs, overround } = devig({ KC: 100, BUF: 100, DAL: 100 });
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(overround).toBeCloseTo(50, 1); // three 50% books = 150% market
  });
});
