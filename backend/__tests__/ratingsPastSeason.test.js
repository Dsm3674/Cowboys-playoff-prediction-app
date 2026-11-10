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
jest.mock("../services/marketFutures", () => ({ readFutures: () => ({ odds: null }) }));
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
  });

  test("a finished season ignores today's injuries", async () => {
    const r = await getPowerRatings({ year: 2025 });
    expect(sea(r).injuryDelta).toBe(0);
    expect(sea(r).nextGameInjuryDelta).toBe(0);
    expect(sea(r).power).toBe(sea(r).elo);
    expect(r.injuryFeed).toBe("not-applied");
  });
});
