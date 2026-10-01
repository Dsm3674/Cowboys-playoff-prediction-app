"use strict";

const {
  simulateSeason,
  projectSeeds,
  playoffCurve,
  _internals: { buildLeague, runSimulation, makeTiebreaker },
} = require("../services/seasonSimulator");
const { simulatePlayoffPaths } = require("../services/playoffPathEngine");
const { backtestFromData, scoreBinary } = require("../services/backtest");
const { projectPlayoffProbability } = require("../seasonPath");
const { mulberry32 } = require("../services/bracketCore");
const analyticsRouter = require("../routes/analytics");
const cache = require("../cache");

/* A 32-team league: 8 divisions of 4, power spread 1350-1650, with a
   17-game schedule (6 division games + 11 rotating). Games are dated a week
   apart in schedule order; the first `playedWeeks` weeks are final, decided by
   `decide(homePower, awayPower, rand)`. */
function syntheticLeague({ playedWeeks = 5, decide = null, seed = 3 } = {}) {
  const rand = mulberry32(seed);
  const confs = { AFC: ["East", "North", "South", "West"], NFC: ["East", "North", "South", "West"] };
  const teams = [];
  let k = 0;
  for (const [conference, divisions] of Object.entries(confs)) {
    for (const d of divisions) {
      for (let i = 0; i < 4; i++) {
        teams.push({
          code: `${conference[0]}${d[0]}${i}`,
          name: `${conference} ${d} ${i}`,
          conference,
          division: `${conference} ${d}`,
          power: 1350 + ((k * 97) % 300),
        });
        k++;
      }
    }
  }
  teams.find((t) => t.code === "NE1").code = "DAL";

  const byDiv = {};
  teams.forEach((t) => { (byDiv[t.division] = byDiv[t.division] || []).push(t.code); });
  const pairs = [];
  for (const codes of Object.values(byDiv)) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) pairs.push([codes[i], codes[j]]);
  }
  for (let w = 0; w < 11; w++) {
    const order = teams.map((t) => t.code).sort(() => rand() - 0.5);
    for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  }

  const power = Object.fromEntries(teams.map((t) => [t.code, t.power]));
  const games = pairs.map(([h, a], i) => {
    const week = Math.floor(i / 16) + 1;
    const g = {
      id: String(i),
      week,
      date: new Date(Date.UTC(2026, 8, 1 + (week - 1) * 7)).toISOString(),
      homeTeamAbbr: h,
      awayTeamAbbr: a,
      completed: week <= playedWeeks,
      homeScore: 0,
      awayScore: 0,
    };
    if (g.completed) {
      const homeWins = decide ? decide(power[h], power[a], rand) : rand() < 0.5;
      g.homeScore = homeWins ? 24 : 17;
      g.awayScore = homeWins ? 17 : 24;
    }
    return g;
  });

  return { ratings: { year: 2026, updatedAt: "test", lastCompletedWeek: playedWeeks, ratings: teams }, games };
}

const strongerWins = (h, a) => h + 20 >= a;

describe("seasonSimulator — league season", () => {
  const { ratings, games } = syntheticLeague();
  const sim = runSimulation({ ratings: ratings.ratings, games, iterations: 3000, seed: 11 });

  test("each simulated season fills exactly 14 playoff spots, 8 divisions, 2 byes, 1 champion", () => {
    const sum = (field) => sim.teams.reduce((s, t) => s + t[field], 0);
    expect(sum("playoffPct")).toBeCloseTo(1400, 0);
    expect(sum("divisionPct")).toBeCloseTo(800, 0);
    expect(sum("byePct")).toBeCloseTo(200, 0);
    expect(sum("winSBPct")).toBeCloseTo(100, 0);
    expect(sim.gamesRemaining).toBe(games.filter((g) => !g.completed).length);
  });

  test("per-team odds are internally consistent", () => {
    for (const t of sim.teams) {
      const seedSum = t.seedPct.reduce((a, b) => a + b, 0);
      expect(seedSum).toBeCloseTo(t.playoffPct, 0);
      expect(t.byePct).toBe(t.seedPct[0]);
      expect(t.divisionPct).toBeLessThanOrEqual(t.playoffPct);
      expect(t.reachCCPct).toBeLessThanOrEqual(t.reachDivisionalPct);
      expect(t.reachSBPct).toBeLessThanOrEqual(t.reachCCPct);
      expect(t.winSBPct).toBeLessThanOrEqual(t.reachSBPct);
      expect(t.avgWins + t.avgLosses + t.avgTies).toBeCloseTo(17, 1);
    }
  });

  test("stronger teams make the playoffs more often", () => {
    const sorted = sim.teams.slice().sort((a, b) => b.power - a.power);
    const top = sorted.slice(0, 8).reduce((s, t) => s + t.playoffPct, 0);
    const bottom = sorted.slice(-8).reduce((s, t) => s + t.playoffPct, 0);
    expect(top).toBeGreaterThan(bottom * 2);
  });

  test("is deterministic under a seed", () => {
    const again = runSimulation({ ratings: ratings.ratings, games, iterations: 3000, seed: 11 });
    expect(again.teams.map((t) => t.playoffPct)).toEqual(sim.teams.map((t) => t.playoffPct));
  });

  test("hot ratings widen uncertainty: the best team is less of a lock", () => {
    const fixed = runSimulation({ ratings: ratings.ratings, games, iterations: 4000, seed: 5, hot: false });
    const hot = runSimulation({ ratings: ratings.ratings, games, iterations: 4000, seed: 5, hot: true });
    const best = ratings.ratings.slice().sort((a, b) => b.power - a.power)[0].code;
    const p = (out) => out.teams.find((t) => t.code === best).playoffPct;
    expect(p(hot)).toBeLessThan(p(fixed));
  });

  test("a finished season reproduces its own standings", () => {
    const done = syntheticLeague({ playedWeeks: 99, decide: strongerWins });
    const out = runSimulation({ ratings: done.ratings.ratings, games: done.games, iterations: 500, seed: 1 });
    expect(out.gamesRemaining).toBe(0);
    // Without coin-flip ties, every team is either always in or always out.
    const settled = out.teams.filter((t) => t.playoffPct === 0 || t.playoffPct === 100);
    expect(settled.length).toBeGreaterThanOrEqual(28);
  });
});

describe("seasonSimulator — tiebreakers", () => {
  // One division. A and B finish 4-2 and A swept B; D and C finish 2-4 and
  // D swept C. Expected order: A, B, D, C.
  const teams = ["A", "B", "C", "D"].map((code) => ({
    code, conference: "NFC", division: "East", power: 1500,
  }));
  const results = [
    ["A", "B"], ["B", "A", true],
    ["B", "C"], ["C", "B", true],
    ["B", "D"], ["D", "B", true],
    ["C", "A"], ["A", "C", true],
    ["A", "D"], ["D", "A", true],
    ["D", "C"], ["C", "D", true],
  ];
  // [home, away, awayWon]
  const games = results.map(([h, a, awayWon], i) => ({
    homeTeamAbbr: h, awayTeamAbbr: a, completed: true,
    homeScore: awayWon ? 10 : 20, awayScore: awayWon ? 20 : 10,
    date: new Date(Date.UTC(2026, 8, 1 + i * 7)).toISOString(),
  }));

  test("division ties go to head-to-head first", () => {
    const league = buildLeague(teams, games);
    const tb = makeTiebreaker(league, league.base, mulberry32(1));
    const order = tb.order([0, 1, 2, 3], "division").map((i) => league.teams[i].code);
    expect(order).toEqual(["A", "B", "D", "C"]);
  });

  test("conference ties between teams that never met skip head-to-head", () => {
    // X and Y are 1-1, never met; X's win came against a conference team.
    const pair = [
      { code: "X", conference: "AFC", division: "East", power: 1500 },
      { code: "Y", conference: "AFC", division: "West", power: 1500 },
      { code: "P", conference: "AFC", division: "North", power: 1500 },
      { code: "Q", conference: "NFC", division: "North", power: 1500 },
    ];
    const g = [
      { homeTeamAbbr: "X", awayTeamAbbr: "P", completed: true, homeScore: 20, awayScore: 10, date: "2026-09-01" },
      { homeTeamAbbr: "X", awayTeamAbbr: "Q", completed: true, homeScore: 10, awayScore: 20, date: "2026-09-08" },
      { homeTeamAbbr: "Y", awayTeamAbbr: "Q", completed: true, homeScore: 20, awayScore: 10, date: "2026-09-15" },
      { homeTeamAbbr: "Y", awayTeamAbbr: "P", completed: true, homeScore: 10, awayScore: 20, date: "2026-09-22" },
    ];
    const league = buildLeague(pair, g);
    const tb = makeTiebreaker(league, league.base, mulberry32(1));
    expect(league.teams[tb.pickBest([0, 1], "conference")].code).toBe("X");
  });
});

describe("seasonSimulator — derived outputs", () => {
  test("projected seeds give seven teams per conference, four division winners on top", async () => {
    const { ratings, games } = syntheticLeague();
    const out = await simulateSeason({ ratingsOverride: ratings, gamesOverride: games, iterations: 1000 });
    for (const conf of ["AFC", "NFC"]) {
      const seeds = out.projectedSeeds[conf];
      expect(seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      const divisions = new Set(seeds.slice(0, 4).map((s) => ratings.ratings.find((t) => t.code === s.code).division));
      expect(divisions.size).toBe(4);
    }
    expect(projectSeeds(out.teams)).toEqual(out.projectedSeeds);
  });

  test("playoff curve is monotone, bounded, and drives season-path odds", () => {
    const { ratings, games } = syntheticLeague({ playedWeeks: 3 });
    const out = runSimulation({ ratings: ratings.ratings, games, iterations: 3000, seed: 2 });
    const dal = out.teams.find((t) => t.code === "DAL");
    const curve = playoffCurve(dal);
    let prev = 0;
    for (let w = 0; w <= 17; w++) {
      expect(curve[w]).toBeGreaterThanOrEqual(prev);
      expect(curve[w]).toBeLessThanOrEqual(1);
      prev = curve[w];
    }
    expect(projectPlayoffProbability(11, curve)).toBe(curve[11]);
    expect(projectPlayoffProbability(10, null)).toBe(0.635); // legacy fallback
  });
});

describe("playoffPathEngine on the league simulator", () => {
  test("the field changes between simulated seasons and misses are counted", async () => {
    const { ratings, games } = syntheticLeague({ playedWeeks: 4 });
    const out = await simulatePlayoffPaths({
      focusTeam: "DAL", iterations: 2000, seed: 9, ratingsOverride: ratings, gamesOverride: games,
    });
    expect(out.teams.length).toBeGreaterThan(14);
    const exits = Object.values(out.focusRoundExits).reduce((a, b) => a + b, 0);
    expect(exits).toBe(out.iterations);
    expect(out.focusRoundExits.MISSED).toBeGreaterThan(0);
    expect(out.seeds.AFC).toHaveLength(7);
    expect(out.topSeeds.NFC).toEqual(expect.any(String));
  });
});

describe("backtest", () => {
  test("scoreBinary matches hand-computed values", () => {
    const s = scoreBinary([{ prob: 0.8, outcome: 1 }, { prob: 0.4, outcome: 0 }]);
    expect(s.brier).toBeCloseTo((0.04 + 0.16) / 2, 6);
    expect(s.accuracy).toBe(1);
  });

  test("on a season where the better team usually wins, the model beats a coin flip", () => {
    const decide = (h, a, rand) => rand() < 1 / (1 + 10 ** (-(h - a) / 400));
    const { ratings, games } = syntheticLeague({ playedWeeks: 99, decide });
    // A prior close to the truth, as last season's carryover would be.
    const prior = Object.fromEntries(ratings.ratings.map((t) => [t.code, 1500 + (t.power - 1500) * 0.67]));
    const out = backtestFromData({
      games, prior, teams: ratings.ratings, // backtest overwrites power from its own Elo
      iterations: 500, checkpoints: [4, 10],
    });

    expect(out.games.n).toBe(games.length - games.filter((g) => g.homeScore === g.awayScore).length);
    expect(out.games.brier).toBeLessThan(out.games.baselines.coinFlip.brier);
    expect(out.playoffs.actualPlayoffTeams).toHaveLength(14);
    expect(out.playoffs.checkpoints.map((c) => c.afterWeek)).toEqual([4, 10]);
    for (const c of out.playoffs.checkpoints) {
      expect(c.brier).toBeLessThan(c.baselineBrier);
      expect(c.biggestMisses).toHaveLength(3);
    }
  });
});

describe("analytics pages read the league simulation", () => {
  afterAll(() => cache.destroy());

  const row = (code, wins, losses) => ({
    code, name: code, conference: "NFC", division: "NFC East",
    record: { wins, losses, ties: 0, winPct: wins / (wins + losses) },
    averages: { pointDiffPerGame: 3 }, tsi: 60, _injuryDelta: 0,
  });
  const simEntry = { avgWins: 11.4, avgLosses: 5.6, playoffPct: 81.25, divisionPct: 55.5, byePct: 12.1, winSBPct: 9.04 };

  test("forecast and pulse use simulated wins and odds when available", () => {
    const [f] = analyticsRouter.buildForecast([row("DAL", 3, 1)], { DAL: simEntry });
    expect(f.projectedWins).toBe(11.4);
    expect(f.playoffProbability).toBe(81.3);
    expect(f.divisionProbability).toBe(55.5);
    expect(f.superBowlProbability).toBe(9);

    const [p] = analyticsRouter.buildPlayoffPulse([row("DAL", 3, 1)], { DAL: simEntry });
    expect(p.playoffProbability).toBe(81.3);
    expect(p.source).toBe("league-simulation");

    const [legacy] = analyticsRouter.buildPlayoffPulse([row("DAL", 3, 1)]);
    expect(legacy.source).toBe("legacy-formula");
  });

  test("bracket uses projected seeds and reseeds the divisional round", () => {
    const rows = [];
    for (const conf of ["AFC", "NFC"]) {
      for (let i = 1; i <= 7; i++) {
        rows.push({ ...row(`${conf[0]}${i}`, 10, 7), conference: conf, _elo: 1700 - i * 30 });
      }
    }
    // Make the 7 seed a juggernaut so it wins its wild-card game.
    rows.find((r) => r.code === "N7")._elo = 1900;
    const projected = {
      AFC: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ code: `A${i}` })),
      NFC: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ code: `N${i}` })),
    };
    const bracket = analyticsRouter.buildPlayoffBracket(rows, 2026, projected);
    expect(bracket.nfc.wildCard[0].top.abbr).toBe("N2");
    expect(bracket.nfc.wildCard[0].bottom.abbr).toBe("N7");
    // N7 survives as the lowest seed, so it visits the 1 seed.
    const oneSeedGame = bracket.nfc.divisional[1];
    expect([oneSeedGame.top.abbr, oneSeedGame.bottom.abbr].sort()).toEqual(["N1", "N7"]);
  });
});

describe("game lines and neutral sites", () => {
  const { gameMarketProb } = require("../services/oddsMath");
  const { parseEspnScheduleEvents } = require("../services/espn");
  const { parseNflverseGames } = require("../services/backtest");
  const { replayGamesToElo } = require("../services/ratingsEngine");

  test("moneylines de-vig and spreads convert on the fitted scale", () => {
    expect(gameMarketProb({ homeMoneyLine: -150, awayMoneyLine: 130 })).toBeCloseTo(0.5798, 3);
    // Home favored by 7: negative home spread, about 73%.
    expect(gameMarketProb({ homeSpread: -7 })).toBeCloseTo(1 / (1 + Math.exp(-1)), 6);
    expect(gameMarketProb({ homeSpread: 3 })).toBeLessThan(0.5);
    expect(gameMarketProb({})).toBeNull();
  });

  test("ESPN events carry neutral sites and lines for unplayed games only", () => {
    const comp = (completed, odds) => ({
      neutralSite: true,
      status: { type: { completed, state: completed ? "post" : "pre" } },
      competitors: [
        { homeAway: "home", team: { abbreviation: "DAL" }, score: { value: 0 } },
        { homeAway: "away", team: { abbreviation: "PHI" }, score: { value: 0 } },
      ],
      odds,
    });
    const odds = [{ spread: 3.5, homeTeamOdds: { favorite: false }, awayTeamOdds: { favorite: true } }];
    const [upcoming, done] = parseEspnScheduleEvents([
      { id: "1", competitions: [comp(false, odds)] },
      { id: "2", competitions: [comp(true, odds)] },
    ]);
    expect(upcoming.neutralSite).toBe(true);
    expect(upcoming.homeSpread).toBe(3.5); // away favored → home is +3.5
    expect(upcoming.marketHomeProb).toBeLessThan(0.5);
    expect(done.marketHomeProb).toBeNull();
  });

  test("neutral-site results move Elo without a home edge", () => {
    const g = (neutralSite) => [{ homeTeamAbbr: "A", awayTeamAbbr: "B", completed: true, homeScore: 20, awayScore: 17, date: "2026-09-01", neutralSite }];
    const home = replayGamesToElo(g(false)).elo.A;
    const neutral = replayGamesToElo(g(true)).elo.A;
    // Winning without home field was less expected, so it earns more.
    expect(neutral).toBeGreaterThan(home);
  });

  test("the simulator plays a game at its market line", () => {
    const { ratings, games } = syntheticLeague({ playedWeeks: 16 });
    const target = games.find((g) => !g.completed);
    const loser = target.homeTeamAbbr;
    target.marketHomeProb = 0.001; // the market all but rules the home side out
    const out = runSimulation({ ratings: ratings.ratings, games, iterations: 2000, seed: 4 });
    expect(out.gamesWithMarketLines).toBe(1);
    const base = runSimulation({
      ratings: ratings.ratings,
      games: games.map((g) => (g === target ? { ...g, marketHomeProb: null } : g)),
      iterations: 2000,
      seed: 4,
    });
    const wins = (sim) => sim.teams.find((t) => t.code === loser).avgWins;
    expect(wins(out)).toBeLessThan(wins(base));
  });

  test("nflverse rows map franchise codes, neutral sites and closing lines", () => {
    const csv = [
      "game_id,season,game_type,week,gameday,away_team,away_score,home_team,home_score,location,away_moneyline,home_moneyline,spread_line,roof",
      '2019_01_LA_OAK,2019,REG,1,2019-09-08,LA,30,OAK,24,Home,120,-140,2.5,""',
      "2022_04_MIN_NO,2022,REG,4,2022-10-02,MIN,28,NO,25,Neutral,,,-4,outdoors",
      "2022_19_X_Y,2022,WC,19,2023-01-14,MIN,28,NYG,31,Home,,,3,outdoors",
    ].join("\n");
    const by = parseNflverseGames(csv);
    const [g1] = by[2019];
    expect([g1.homeTeamAbbr, g1.awayTeamAbbr]).toEqual(["LV", "LAR"]);
    expect(g1.closingHomeProb).toBeGreaterThan(0.5);
    const [g2] = by[2022];
    expect(by[2022]).toHaveLength(1); // playoff row dropped
    expect(g2.neutralSite).toBe(true);
    // spread_line -4 means the home side (NO) was a 4-point underdog.
    expect(g2.closingHomeProb).toBeLessThan(0.5);
  });

  test("backtests report the Vegas baseline when closing lines exist", () => {
    const decide = (h, a, rand) => rand() < 1 / (1 + 10 ** (-(h - a) / 400));
    const { ratings, games } = syntheticLeague({ playedWeeks: 99, decide });
    games.forEach((g) => { g.closingHomeProb = 0.55; });
    const out = backtestFromData({ games, teams: ratings.ratings, includePlayoffs: false });
    expect(out.games.baselines.vegas.n).toBe(out.games.n);
    expect(out.games.baselines.vegas.modelOnSameGames).toBe(out.games.brier);
  });
});
