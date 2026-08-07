"use strict";

jest.mock("node-fetch", () => jest.fn());

const fetch = require("node-fetch");
const {
  normalizeTeamAbbr,
  getNFLTeamList,
  fetchTeamGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
  _resetScheduleCache
} = require("../services/espn");

describe("ESPN team abbreviation aliases", () => {
  beforeEach(() => {
    fetch.mockReset();
    _resetScheduleCache();
  });

  test("normalizes ESPN's WSH code to the app's WAS code", () => {
    expect(normalizeTeamAbbr("WSH")).toBe("WAS");
    expect(normalizeTeamAbbr("was")).toBe("WAS");
  });

  test("returns Washington once with complete NFC East metadata", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sports: [{
          leagues: [{
            teams: [
              { team: { id: "28", abbreviation: "WSH", displayName: "Washington Commanders" } },
              { team: { id: "6", abbreviation: "DAL", displayName: "Dallas Cowboys" } }
            ]
          }]
        }]
      })
    });

    const teams = await getNFLTeamList();
    const washington = teams.filter((team) => team.code === "WAS");

    expect(washington).toEqual([{
      code: "WAS",
      name: "Washington Commanders",
      conference: "NFC",
      division: "NFC East"
    }]);
    expect(teams.some((team) => team.code === "WSH")).toBe(false);
  });

  test("calculates Washington results when ESPN game data uses WSH", () => {
    const games = [{
      completed: true,
      homeTeamAbbr: "WSH",
      awayTeamAbbr: "DAL",
      homeScore: 27,
      awayScore: 20
    }];

    expect(computeRecordFromGames(games, "WAS")).toMatchObject({
      wins: 1,
      losses: 0,
      ties: 0
    });
    expect(computeTeamAveragesFromGames("WAS", games)).toMatchObject({
      gamesPlayed: 1,
      avgFor: 27,
      avgAgainst: 20,
      pointDiffPerGame: 7
    });
  });

  test("uses ESPN's WSH slug when the team-id lookup is unavailable", async () => {
    fetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ events: [] }) });

    await fetchTeamGamesSeasonToDate("WAS", 2025);

    expect(fetch).toHaveBeenLastCalledWith(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/wsh/schedule?season=2025"
    );
  });
});
