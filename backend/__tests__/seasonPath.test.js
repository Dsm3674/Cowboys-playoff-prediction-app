"use strict";

describe("seasonPath with mocked data", () => {
  const games = [
    // NYG at home, won: must count as a win for NYG.
    { id: "g1", homeTeamAbbr: "NYG", awayTeamAbbr: "DAL", homeScore: 28, awayScore: 20, completed: true, date: "2026-09-10" },
    { id: "g2", homeTeamAbbr: "PHI", awayTeamAbbr: "NYG", homeScore: 0, awayScore: 0, completed: false, date: "2026-09-17", marketHomeProb: 0.7 },
    { id: "g3", homeTeamAbbr: "NYG", awayTeamAbbr: "WAS", homeScore: 0, awayScore: 0, completed: false, date: "2026-09-24", neutralSite: true },
  ];
  const elo = { NYG: { power: 1500 }, PHI: { power: 1550 }, WAS: { power: 1500 }, DAL: { power: 1500 } };

  let seasonPath;
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../services/espn", () => ({
      ...jest.requireActual("../services/espn"),
      fetchTeamGamesSeasonToDate: async () => games,
    }));
    jest.doMock("../services/ratingsEngine", () => ({
      ...jest.requireActual("../services/ratingsEngine"),
      getEloSnapshot: async () => ({ available: true, byTeam: elo }),
    }));
    jest.doMock("../services/seasonSimulator", () => ({
      ...jest.requireActual("../services/seasonSimulator"),
      getSeasonSimulation: async () => { throw new Error("offline"); },
    }));
    seasonPath = require("../seasonPath");
  });
  afterEach(() => jest.dontMock("../services/espn"));

  test("a home win counts for the team asked about, not Dallas", async () => {
    const out = await seasonPath.buildSeasonPaths({ teamAbbr: "NYG", year: 2026, iterations: 500, k: 4 });
    expect(out.record.wins).toBe(1);
    expect(out.record.losses).toBe(0);
  });

  test("game odds come from the line, else Elo with no home edge at neutral sites", async () => {
    const out = await seasonPath.buildSeasonPaths({ teamAbbr: "NYG", year: 2026, iterations: 500, k: 4 });
    const [atPhi, vsWas] = out.remainingGames;
    expect(atPhi.source).toBe("market");
    expect(atPhi.pWin).toBeCloseTo(0.3, 4);
    expect(vsWas.source).toBe("elo");
    expect(vsWas.pWin).toBeCloseTo(0.5, 4);
    expect(out.paths).toHaveLength(4);
    const total = out.paths.reduce((s, p) => s + p.probability, 0);
    expect(total).toBeCloseTo(1, 4); // 2 games → exactly 4 paths
    // 30% and 50% games: L-W and L-L tie at 35% for the most likely path.
    expect(out.paths[0].outcomes[0].result).toBe("L");
    expect(out.paths[0].probability).toBeCloseTo(0.35, 6);
    expect(out.paths[3].probability).toBeCloseTo(0.15, 6);
  });

  test("chaos pulls games toward a coin flip", async () => {
    const calm = await seasonPath.buildSeasonPaths({ teamAbbr: "NYG", year: 2026, iterations: 500, chaos: 0 });
    const wild = await seasonPath.buildSeasonPaths({ teamAbbr: "NYG", year: 2026, iterations: 500, chaos: 1.5 });
    expect(Math.abs(wild.remainingGames[0].pWin - 0.5)).toBeCloseTo(Math.abs(calm.remainingGames[0].pWin - 0.5) / 2, 4);
  });
});

describe("leverage from the league simulation", () => {
  const { _internals: { runSimulation }, gameLeverage } = require("../services/seasonSimulator");
  const { mulberry32 } = require("../services/bracketCore");

  // Two 16-team conferences with one unplayed division decider at the end.
  function league() {
    const ratings = [];
    for (const conf of ["AFC", "NFC"]) {
      for (const d of ["East", "North", "South", "West"]) {
        for (let i = 0; i < 4; i++) {
          ratings.push({ code: `${conf[0]}${d[0]}${i}`, conference: conf, division: `${conf} ${d}`, power: 1500 });
        }
      }
    }
    const rand = mulberry32(1);
    const games = [];
    let day = 1;
    for (let w = 0; w < 10; w++) {
      const order = ratings.map((t) => t.code).sort(() => rand() - 0.5);
      for (let i = 0; i < order.length; i += 2) {
        const homeWins = rand() < 0.5;
        games.push({ id: `${w}-${i}`, homeTeamAbbr: order[i], awayTeamAbbr: order[i + 1], completed: true,
          homeScore: homeWins ? 21 : 14, awayScore: homeWins ? 14 : 21, date: `2026-09-${String(day).padStart(2, "0")}` });
      }
      day += 1;
    }
    games.push({ id: "decider", homeTeamAbbr: "NE0", awayTeamAbbr: "NE1", completed: false, homeScore: 0, awayScore: 0, date: "2026-12-30" });
    return { ratings, games };
  }

  test("a team's own game moves its playoff odds the right way", () => {
    const { ratings, games } = league();
    const sim = runSimulation({ ratings, games, iterations: 3000, seed: 3 });
    const [row] = gameLeverage(sim, "NE0");
    expect(row.id).toBe("decider");
    expect(row.playoffPctIfHomeWins).toBeGreaterThanOrEqual(row.playoffPctIfAwayWins);
    const other = gameLeverage(sim, "NE1")[0];
    expect(other.playoffPctIfAwayWins).toBeGreaterThanOrEqual(other.playoffPctIfHomeWins);
    expect(row.homeWinPct).toBeGreaterThan(40);
    expect(row.homeWinPct).toBeLessThan(65);
  });
});
