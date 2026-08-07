"use strict";

const analyticsRouter = require("../routes/analytics");
const cache = require("../cache");

function team(code, tsi, pointDiff, wins, losses) {
  return {
    code,
    name: code,
    record: { wins, losses, ties: 0, winPct: wins / (wins + losses) },
    averages: { avgFor: 24, avgAgainst: 21, pointDiffPerGame: pointDiff },
    tsi,
    _elo: null
  };
}

describe("Analytics matchup response", () => {
  afterAll(() => cache.destroy());

  test("includes populated outcome metrics and team profile fields", () => {
    const response = analyticsRouter.buildMatchupResponse(
      team("DAL", 60, 3, 10, 7),
      team("PHI", 70, 8, 12, 5),
      2025
    );

    expect(response.homeWinProbability).toEqual(expect.any(Number));
    expect(response.awayWinProbability).toEqual(expect.any(Number));
    expect(response.expectedMargin).toEqual(expect.any(Number));
    expect(response.homeWinProbability + response.awayWinProbability).toBe(100);
    expect(response.matchup).toEqual({
      homeWinProbability: response.homeWinProbability,
      awayWinProbability: response.awayWinProbability,
      expectedMargin: response.expectedMargin
    });
    expect(response.teams).toHaveLength(2);
    expect(response.teams[0].averagePointDiff).toBe(3);
    expect(response.teams[0].playoffProbability).toEqual(expect.any(Number));
  });

  test("converts internal strength ratings into realistic point margins", () => {
    const underdog = team("KC", 45, -12, 2, 15);
    const favorite = team("LAR", 90, 18, 15, 2);
    underdog._elo = 1200;
    favorite._elo = 1800;

    const response = analyticsRouter.buildMatchupResponse(underdog, favorite, 2025);

    expect(response.expectedMargin).toBe(-21);
    expect(response.homeWinProbability).toBe(10);
    expect(response.awayWinProbability).toBe(90);
  });

  test("includes a modest home-field edge for evenly matched teams", () => {
    const home = team("DAL", 60, 3, 10, 7);
    const away = team("PHI", 60, 3, 10, 7);

    const response = analyticsRouter.buildMatchupResponse(home, away, 2025);

    expect(response.expectedMargin).toBe(1.5);
    expect(response.homeWinProbability).toBeGreaterThan(50);
  });
});
