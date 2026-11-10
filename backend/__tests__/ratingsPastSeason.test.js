"use strict";

/* Today's injury report must not move the ratings of a season that is over. */

jest.mock("../services/espn", () => ({
  ...jest.requireActual("../services/espn"),
  getNFLSeasonYear: () => 2026,
  getNFLTeamList: async () => [{ code: "SEA" }, { code: "DEN" }],
  getNFLTeamMetadata: () => ({}),
  fetchTeamGamesSeasonToDate: async () => [],
  fetchScoreboardLines: async () => ({}),
}));
jest.mock("../tsi", () => ({ computeTSI: async () => ({ tsi: 50 }) }));
jest.mock("../services/marketFutures", () => ({
  // A full 32-team board; if it were read for a past season the prior
  // source would say so.
  readFutures: () => ({
    odds: Object.fromEntries(
      ["ARI","ATL","BAL","BUF","CAR","CHI","CIN","CLE","DAL","DEN","DET","GB","HOU","IND","JAX","KC",
       "LV","LAC","LAR","MIA","MIN","NE","NO","NYG","NYJ","PHI","PIT","SF","SEA","TB","TEN","WAS"]
        .map((code, i) => [code, 400 + i * 300])
    ),
  }),
}));
jest.mock("../services/injuries", () => ({
  ...jest.requireActual("../services/injuries"),
  getInjuryDeltas: async () => ({
    available: true,
    byTeam: {
      SEA: { delta: -112.5, players: [{ name: "QB1", position: "QB", status: "Out", elo: -112.5, gamesOut: 1 }] },
    },
  }),
}));

const { getPowerRatings, _invalidateRatingsCache } = require("../services/ratingsEngine");

describe("ratingsEngine — injuries and past seasons", () => {
  beforeEach(() => _invalidateRatingsCache());

  const sea = (r) => r.ratings.find((t) => t.code === "SEA");

  test("the current season carries the live injury delta", async () => {
    const r = await getPowerRatings({ year: 2026 });
    expect(sea(r).injuryDelta).toBe(-112.5);
    expect(r.injuryFeed).toBe("espn");
    expect(r.priorSource).toBe("market");
  });

  test("a finished season ignores today's injuries", async () => {
    const r = await getPowerRatings({ year: 2025 });
    expect(sea(r).injuryDelta).toBe(0);
    expect(sea(r).nextGameInjuryDelta).toBe(0);
    expect(sea(r).power).toBe(sea(r).elo);
    expect(r.injuryFeed).toBe("not-applied");
  });

  test("a finished season is not seeded from today's futures board", async () => {
    const r = await getPowerRatings({ year: 2025 });
    expect(r.priorSource).not.toMatch(/market/);
    expect(sea(r).elo).toBe(1500);
  });
});
