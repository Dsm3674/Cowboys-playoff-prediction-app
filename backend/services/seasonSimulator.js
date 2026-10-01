"use strict";

/**
 * seasonSimulator
 * Plays out the rest of the NFL regular season for all 32 teams, seeds each
 * conference with the NFL tiebreakers, then runs the playoff bracket. Every
 * playoff, division, seed and Super Bowl number in the app comes from here.
 *
 * Two choices follow the forecasting literature:
 *   - Ratings run "hot": each simulated result moves both teams' Elo the same
 *     way a real result would (K, margin-of-victory multiplier). A team that
 *     starts a simulated season 4-0 is rated higher for game five. This is the
 *     FiveThirtyEight approach, and the practical form of Glickman & Stern's
 *     point that team strength drifts through a season: forecasts made far out
 *     carry more uncertainty than a fixed rating would admit.
 *   - Standings are decided by the real tiebreaker ladder (head-to-head,
 *     division record, common games, conference record, strength of victory,
 *     strength of schedule, net points, coin flip) instead of win totals, so
 *     a 10-7 team that loses the tiebreaker misses the playoffs here too.
 *
 * Simplifications: no tie games are simulated, neutral-site regular-season
 * games are treated as home games, and the tiebreak ladder stops at net points
 * in all games (the NFL's combined-ranking and net-touchdown steps are skipped).
 */

const {
  eloWinProb,
  movMultiplier,
  ELO_K,
  ELO_HOME_FIELD,
  getPowerRatings,
  buildLeagueGames,
} = require("./ratingsEngine");
const { mulberry32, playGame, playConference } = require("./bracketCore");
const { getNFLSeasonYear } = require("./espn");

const DEFAULT_ITERATIONS = 10000;
const MIN_ITERATIONS = 500;
const MAX_ITERATIONS = 100000;
const DEFAULT_SEED = 20260901;
const MARGIN_SD = 13; // NFL final margins scatter ~13 points around the spread
const ELO_PER_POINT = 25; // FiveThirtyEight convention: 25 Elo ≈ 1 point
const SIM_TTL_MS = 10 * 60 * 1000;
const EPS = 1e-9;

function clampIterations(n) {
  const v = Number(n) || DEFAULT_ITERATIONS;
  return Math.max(MIN_ITERATIONS, Math.min(MAX_ITERATIONS, Math.floor(v)));
}

function pct(w, l, t) {
  const n = w + l + t;
  return n > 0 ? (w + 0.5 * t) / n : 0;
}

/* ── League setup ──────────────────────────────────────────────────────── */

/**
 * Flatten ratings + schedule into index-addressed arrays. When no games are
 * supplied (tests, or ESPN unreachable) the standings start from each team's
 * `record` and the season is treated as finished.
 */
function buildLeague(ratings, games) {
  const teams = ratings.filter((t) => t && t.code && t.conference && t.division);
  const N = teams.length;
  const index = new Map(teams.map((t, i) => [t.code, i]));
  const conf = teams.map((t) => t.conference);
  const div = teams.map((t) => `${t.conference}|${t.division}`);
  const basePower = Float64Array.from(teams, (t) => Number(t.power) || 1500);

  const schedule = (games || [])
    .filter((g) => index.has(String(g.homeTeamAbbr).toUpperCase()) && index.has(String(g.awayTeamAbbr).toUpperCase()))
    .map((g) => ({
      h: index.get(String(g.homeTeamAbbr).toUpperCase()),
      a: index.get(String(g.awayTeamAbbr).toUpperCase()),
      completed: Boolean(g.completed),
      homeScore: Number(g.homeScore) || 0,
      awayScore: Number(g.awayScore) || 0,
      t: Date.parse(g.date) || 0,
    }))
    .sort((x, y) => x.t - y.t);

  const G = schedule.length;
  const H = Int32Array.from(schedule, (g) => g.h);
  const A = Int32Array.from(schedule, (g) => g.a);
  const sameDiv = Uint8Array.from(schedule, (g) => (div[g.h] === div[g.a] ? 1 : 0));
  const sameConf = Uint8Array.from(schedule, (g) => (conf[g.h] === conf[g.a] ? 1 : 0));

  const teamGames = Array.from({ length: N }, () => []);
  schedule.forEach((g, gi) => {
    teamGames[g.h].push(gi);
    teamGames[g.a].push(gi);
  });

  // Base standings from completed games.
  const base = {
    W: new Float64Array(N), L: new Float64Array(N), T: new Float64Array(N),
    dW: new Float64Array(N), dL: new Float64Array(N), dT: new Float64Array(N),
    cW: new Float64Array(N), cL: new Float64Array(N), cT: new Float64Array(N),
    net: new Float64Array(N),
    res: new Float64Array(G).fill(NaN), // home result: 1 win, 0 loss, 0.5 tie
  };
  const remaining = [];

  schedule.forEach((g, gi) => {
    if (!g.completed) { remaining.push(gi); return; }
    const margin = g.homeScore - g.awayScore;
    recordResult(base, gi, H[gi], A[gi], margin > 0 ? 1 : margin < 0 ? 0 : 0.5, margin, sameDiv[gi], sameConf[gi]);
  });

  if (G === 0) {
    teams.forEach((t, i) => {
      const r = t.record || {};
      base.W[i] = Number(r.wins) || 0;
      base.L[i] = Number(r.losses) || 0;
      base.T[i] = Number(r.ties) || 0;
      base.net[i] = (Number(t.pointDiffPerGame) || 0) * (base.W[i] + base.L[i] + base.T[i]);
    });
  }

  return {
    teams, N, index, conf, div, basePower, G, H, A, sameDiv, sameConf,
    teamGames, base, remaining: Int32Array.from(remaining),
  };
}

function recordResult(s, gi, h, a, homeResult, margin, isDiv, isConf) {
  s.res[gi] = homeResult;
  s.net[h] += margin;
  s.net[a] -= margin;
  if (homeResult === 1) {
    s.W[h]++; s.L[a]++;
    if (isDiv) { s.dW[h]++; s.dL[a]++; }
    if (isConf) { s.cW[h]++; s.cL[a]++; }
  } else if (homeResult === 0) {
    s.W[a]++; s.L[h]++;
    if (isDiv) { s.dW[a]++; s.dL[h]++; }
    if (isConf) { s.cW[a]++; s.cL[h]++; }
  } else {
    s.T[h]++; s.T[a]++;
    if (isDiv) { s.dT[h]++; s.dT[a]++; }
    if (isConf) { s.cT[h]++; s.cT[a]++; }
  }
}

function cloneState(base) {
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = v.slice();
  return out;
}

/* ── Tiebreakers ───────────────────────────────────────────────────────── */

function makeTiebreaker(league, s, rand) {
  const { H, A, teamGames } = league;

  const overall = (i) => pct(s.W[i], s.L[i], s.T[i]);

  // i's record against the teams in `opps` (a Set of indices).
  function recordVs(i, opps) {
    let w = 0, l = 0, t = 0;
    for (const gi of teamGames[i]) {
      const r = s.res[gi];
      if (Number.isNaN(r)) continue;
      const isHome = H[gi] === i;
      const opp = isHome ? A[gi] : H[gi];
      if (!opps.has(opp)) continue;
      const mine = isHome ? r : 1 - r;
      if (mine === 1) w++; else if (mine === 0) l++; else t++;
    }
    return { w, l, t, n: w + l + t };
  }

  function opponentsOf(i) {
    const out = new Set();
    for (const gi of teamGames[i]) {
      if (Number.isNaN(s.res[gi])) continue;
      out.add(H[gi] === i ? A[gi] : H[gi]);
    }
    return out;
  }

  // Strength of victory / schedule: combined record of beaten / all opponents.
  function combinedOpp(i, onlyWins) {
    let w = 0, l = 0, t = 0;
    for (const gi of teamGames[i]) {
      const r = s.res[gi];
      if (Number.isNaN(r)) continue;
      const isHome = H[gi] === i;
      if (onlyWins && (isHome ? r : 1 - r) !== 1) continue;
      const o = isHome ? A[gi] : H[gi];
      w += s.W[o]; l += s.L[o]; t += s.T[o];
    }
    return pct(w, l, t);
  }

  const headToHead = (cand) => {
    return cand.map((i) => {
      const others = new Set(cand.filter((j) => j !== i));
      const r = recordVs(i, others);
      return r.n ? pct(r.w, r.l, r.t) : 0.5;
    });
  };

  // Outside a division, head-to-head only applies between two teams that
  // met, or in a 3+ tie when one team swept (or was swept by) all the others.
  const headToHeadSweep = (cand) => {
    if (cand.length === 2) {
      const [a, b] = cand;
      const r = recordVs(a, new Set([b]));
      if (!r.n) return null;
      const p = pct(r.w, r.l, r.t);
      return [p, 1 - p];
    }
    const vals = cand.map((i) => {
      let sweptAll = true, lostAll = true;
      for (const j of cand) {
        if (j === i) continue;
        const r = recordVs(i, new Set([j]));
        if (!r.n || r.l > 0 || r.t > 0) sweptAll = false;
        if (!r.n || r.w > 0 || r.t > 0) lostAll = false;
      }
      return sweptAll ? 1 : lostAll ? -1 : 0;
    });
    return vals.some((v) => v !== 0) ? vals : null;
  };

  const divisionRecord = (cand) => cand.map((i) => pct(s.dW[i], s.dL[i], s.dT[i]));
  const conferenceRecord = (cand) => cand.map((i) => pct(s.cW[i], s.cL[i], s.cT[i]));

  const commonGames = (minGames) => (cand) => {
    const inTie = new Set(cand);
    let common = null;
    for (const i of cand) {
      const opps = new Set([...opponentsOf(i)].filter((o) => !inTie.has(o)));
      common = common ? new Set([...common].filter((o) => opps.has(o))) : opps;
    }
    if (!common || common.size === 0) return null;
    const recs = cand.map((i) => recordVs(i, common));
    if (recs.some((r) => r.n < minGames)) return null;
    return recs.map((r) => pct(r.w, r.l, r.t));
  };

  const strengthOfVictory = (cand) => cand.map((i) => combinedOpp(i, true));
  const strengthOfSchedule = (cand) => cand.map((i) => combinedOpp(i, false));
  const netPoints = (cand) => cand.map((i) => s.net[i]);

  const LADDERS = {
    division: [headToHead, divisionRecord, commonGames(1), conferenceRecord, strengthOfVictory, strengthOfSchedule, netPoints],
    conference: [headToHeadSweep, conferenceRecord, commonGames(4), strengthOfVictory, strengthOfSchedule, netPoints],
  };

  function keepBest(cand, vals) {
    let best = -Infinity;
    for (const v of vals) if (v > best) best = v;
    return cand.filter((_, k) => vals[k] >= best - EPS);
  }

  /** The single best team in `set` under the given ladder. */
  function pickBest(set, mode) {
    let cand = keepBest(set, set.map(overall));
    const ladder = LADDERS[mode];
    // Whenever a step separates some teams, the survivors restart the ladder.
    while (cand.length > 1) {
      let reduced = false;
      for (const step of ladder) {
        const vals = step(cand);
        if (!vals) continue;
        const next = keepBest(cand, vals);
        if (next.length < cand.length) { cand = next; reduced = true; break; }
      }
      if (!reduced) break;
    }
    return cand.length === 1 ? cand[0] : cand[Math.floor(rand() * cand.length)];
  }

  function order(set, mode) {
    const pool = set.slice();
    const out = [];
    while (pool.length) {
      const best = pickBest(pool, mode);
      out.push(best);
      pool.splice(pool.indexOf(best), 1);
    }
    return out;
  }

  return { pickBest, order };
}

/** Seven seeds for one conference: division winners 1-4, then wild cards. */
function seedConference(league, confName, tb) {
  const divisions = new Map();
  for (let i = 0; i < league.N; i++) {
    if (league.conf[i] !== confName) continue;
    const key = league.div[i];
    if (!divisions.has(key)) divisions.set(key, []);
    divisions.get(key).push(i);
  }

  const divOrders = [...divisions.values()].map((teams) => tb.order(teams, "division"));
  const winners = tb.order(divOrders.map((d) => d[0]), "conference");

  // Wild cards: only the top remaining team from each division is eligible
  // at each pick, so a division tiebreaker is never overridden by a wider one.
  const pools = divOrders.map((d) => d.slice(1));
  const wildcards = [];
  for (let k = 0; k < 3; k++) {
    const heads = pools.filter((p) => p.length).map((p) => p[0]);
    if (!heads.length) break;
    const pick = tb.pickBest(heads, "conference");
    wildcards.push(pick);
    pools.find((p) => p[0] === pick).shift();
  }

  return { seeds: [...winners, ...wildcards], divisionWinners: new Set(winners) };
}

/* ── Simulation ────────────────────────────────────────────────────────── */

function gaussian(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Core loop. `ratings` is the power-ratings table (code, name, conference,
 * division, power, record); `games` the league schedule. `onIteration`, when
 * given, sees every simulated postseason (the path engine uses it).
 */
function runSimulation({ ratings, games, iterations, seed = DEFAULT_SEED, hot = true, onIteration = null }) {
  const league = buildLeague(ratings, games);
  const { N, H, A, sameDiv, sameConf, basePower, remaining } = league;
  const iters = clampIterations(iterations);
  const rand = mulberry32(seed);
  const conferences = [...new Set(league.conf)].sort();

  const acc = league.teams.map(() => ({
    wins: 0, losses: 0, ties: 0, playoff: 0, division: 0,
    seeds: new Array(7).fill(0),
    reachDiv: 0, reachCC: 0, reachSB: 0, winSB: 0,
    winsHist: {}, playoffAtWins: {},
  }));

  // One working copy, reset from the base standings each iteration.
  const s = cloneState(league.base);
  const stateKeys = Object.keys(s);
  const power = basePower.slice();

  for (let it = 0; it < iters; it++) {
    for (const key of stateKeys) s[key].set(league.base[key]);
    power.set(basePower);

    for (const gi of remaining) {
      const h = H[gi], a = A[gi];
      const pHome = eloWinProb(power[h], power[a], ELO_HOME_FIELD);
      const homeWins = rand() < pHome;
      const spread = (power[h] + ELO_HOME_FIELD - power[a]) / ELO_PER_POINT;
      const winnerSpread = homeWins ? spread : -spread;
      const margin = Math.max(1, Math.round(Math.abs(winnerSpread + MARGIN_SD * gaussian(rand))));
      recordResult(s, gi, h, a, homeWins ? 1 : 0, homeWins ? margin : -margin, sameDiv[gi], sameConf[gi]);

      if (hot) {
        const winnerEloDiff = homeWins
          ? power[h] + ELO_HOME_FIELD - power[a]
          : power[a] - (power[h] + ELO_HOME_FIELD);
        const shift = ELO_K * movMultiplier(margin, winnerEloDiff) * ((homeWins ? 1 : 0) - pHome);
        power[h] += shift;
        power[a] -= shift;
      }
    }

    const tb = makeTiebreaker(league, s, rand);
    const byConf = {};
    for (const c of conferences) {
      const { seeds, divisionWinners } = seedConference(league, c, tb);
      if (seeds.length < 7) {
        throw new Error("Not enough seeded teams to build both conference brackets.");
      }
      const seedObjs = seeds.map((i, k) => ({ idx: i, code: league.teams[i].code, seed: k + 1, power: power[i] }));
      byConf[c] = { seeds: seedObjs, divisionWinners, result: playConference(seedObjs, rand) };
    }

    const [c1, c2] = conferences;
    const sbWinner = playGame(byConf[c1].result.champion, byConf[c2].result.champion, rand, true);
    const sbLoser = sbWinner === byConf[c1].result.champion ? byConf[c2].result.champion : byConf[c1].result.champion;

    for (let i = 0; i < N; i++) {
      const a = acc[i];
      const w = s.W[i];
      a.wins += w; a.losses += s.L[i]; a.ties += s.T[i];
      a.winsHist[w] = (a.winsHist[w] || 0) + 1;
    }

    for (const c of conferences) {
      const { seeds, divisionWinners, result } = byConf[c];
      for (const t of seeds) {
        const a = acc[t.idx];
        a.playoff++;
        a.seeds[t.seed - 1]++;
        const w = s.W[t.idx];
        a.playoffAtWins[w] = (a.playoffAtWins[w] || 0) + 1;
        if (divisionWinners.has(t.idx)) a.division++;
        const exit = result.eliminatedRound[t.code];
        if (exit !== "WILD_CARD") a.reachDiv++;
        if (exit === undefined || exit === "CONF_CHAMPIONSHIP") a.reachCC++;
        if (exit === undefined) a.reachSB++;
      }
    }
    acc[sbWinner.idx].winSB++;

    if (onIteration) onIteration({ byConf, sbWinner, sbLoser, conferences });
  }

  const p = (n) => Number(((n / iters) * 100).toFixed(2));
  const teams = league.teams.map((t, i) => {
    const a = acc[i];
    const winsDistribution = {};
    const playoffPctByWins = {};
    for (const [w, n] of Object.entries(a.winsHist)) {
      winsDistribution[w] = p(n);
      playoffPctByWins[w] = Number((((a.playoffAtWins[w] || 0) / n) * 100).toFixed(2));
    }
    return {
      code: t.code,
      name: t.name || t.code,
      conference: t.conference,
      division: t.division,
      power: Number((Number(t.power) || 1500).toFixed(1)),
      record: t.record || null,
      avgWins: Number((a.wins / iters).toFixed(2)),
      avgLosses: Number((a.losses / iters).toFixed(2)),
      avgTies: Number((a.ties / iters).toFixed(2)),
      playoffPct: p(a.playoff),
      divisionPct: p(a.division),
      byePct: p(a.seeds[0]),
      seedPct: a.seeds.map(p),
      reachDivisionalPct: p(a.reachDiv),
      reachCCPct: p(a.reachCC),
      reachSBPct: p(a.reachSB),
      winSBPct: p(a.winSB),
      winsDistribution,
      playoffPctByWins,
      _winsHist: a.winsHist,
      _playoffAtWins: a.playoffAtWins,
    };
  });

  return {
    iterations: iters,
    seed,
    hot,
    gamesPlayed: league.G - remaining.length,
    gamesRemaining: remaining.length,
    teams,
  };
}

/**
 * The most likely bracket: each division goes to the team that wins it most
 * often, division winners are ordered by bye odds then projected wins, and the
 * three best playoff odds among the rest are the wild cards.
 */
function projectSeeds(teams) {
  const out = {};
  for (const c of [...new Set(teams.map((t) => t.conference))].sort()) {
    const confTeams = teams.filter((t) => t.conference === c);
    const divisions = [...new Set(confTeams.map((t) => t.division))];
    const winners = divisions
      .map((d) => confTeams.filter((t) => t.division === d).sort((a, b) => b.divisionPct - a.divisionPct || b.avgWins - a.avgWins)[0])
      .filter(Boolean)
      .sort((a, b) => b.byePct - a.byePct || b.avgWins - a.avgWins);
    const winnerCodes = new Set(winners.map((t) => t.code));
    const wildcards = confTeams
      .filter((t) => !winnerCodes.has(t.code))
      .sort((a, b) => b.playoffPct - a.playoffPct || b.avgWins - a.avgWins)
      .slice(0, 3);
    out[c] = [...winners, ...wildcards].map((t, k) => ({ seed: k + 1, code: t.code, name: t.name, power: t.power }));
  }
  return out;
}

/**
 * Playoff probability given a final win total, for one team. Win totals the
 * simulation rarely produced take the nearest well-sampled total's value, and
 * the curve is forced monotone, so more wins never means worse odds.
 * Returns { wins: probability 0-1 } for 0..17, or null with no usable data.
 */
function playoffCurve(team, minSamples = 25) {
  if (!team?._winsHist) return null;
  const hist = team._winsHist;
  const hits = team._playoffAtWins || {};
  const measured = [];
  for (let w = 0; w <= 17; w++) {
    const n = hist[w] || 0;
    measured[w] = n >= minSamples ? (hits[w] || 0) / n : null;
  }
  const known = measured.map((p, w) => (p === null ? null : w)).filter((w) => w !== null);
  if (!known.length) return null;

  const curve = {};
  let floor = 0;
  for (let w = 0; w <= 17; w++) {
    let p = measured[w];
    if (p === null) {
      const nearest = known.reduce((best, k) => (Math.abs(k - w) < Math.abs(best - w) ? k : best), known[0]);
      p = measured[nearest];
    }
    floor = Math.max(floor, p);
    curve[w] = Number(floor.toFixed(4));
  }
  return curve;
}

/** Team stats without the raw histogram counts the curve is built from. */
function publicTeam(t) {
  const rest = { ...t };
  delete rest._winsHist;
  delete rest._playoffAtWins;
  return rest;
}

/**
 * Full-league season simulation from live ratings and the ESPN schedule.
 * `ratingsOverride` / `gamesOverride` inject data (tests, backtests).
 */
async function simulateSeason({
  year,
  iterations = DEFAULT_ITERATIONS,
  seed = DEFAULT_SEED,
  hot = true,
  ratingsOverride = null,
  gamesOverride = null,
  onIteration = null,
} = {}) {
  const ratings = ratingsOverride || (await getPowerRatings({ year }));
  const games = gamesOverride || (ratingsOverride ? [] : (await buildLeagueGames(ratings.year)).games);
  const sim = runSimulation({ ratings: ratings.ratings, games, iterations, seed, hot, onIteration });

  return {
    year: ratings.year,
    engine: `League season sim · ${hot ? "hot Elo" : "fixed Elo"} · NFL tiebreakers · NFL reseeding`,
    ratingsUpdatedAt: ratings.updatedAt,
    lastCompletedWeek: ratings.lastCompletedWeek,
    ...sim,
    projectedSeeds: projectSeeds(sim.teams),
  };
}

/* Promise cache: the pages that read playoff odds share one run per window. */
const _simCache = new Map();

function getSeasonSimulation({ year, iterations = DEFAULT_ITERATIONS, seed = DEFAULT_SEED } = {}) {
  const key = `${year || getNFLSeasonYear()}:${clampIterations(iterations)}:${seed}`;
  const cached = _simCache.get(key);
  if (cached && Date.now() - cached.ts < SIM_TTL_MS) return cached.promise;

  const promise = simulateSeason({ year, iterations, seed });
  _simCache.set(key, { promise, ts: Date.now() });
  promise.catch(() => _simCache.delete(key));
  return promise;
}

/** code → team stats from the cached run, or {} when the sim is unavailable. */
async function getSimulationByTeam({ year } = {}) {
  try {
    const sim = await getSeasonSimulation({ year });
    return Object.fromEntries(sim.teams.map((t) => [t.code, t]));
  } catch (_err) {
    return {};
  }
}

function _invalidateSimulationCache() {
  _simCache.clear();
}

module.exports = {
  DEFAULT_ITERATIONS,
  MAX_ITERATIONS,
  DEFAULT_SEED,
  simulateSeason,
  getSeasonSimulation,
  getSimulationByTeam,
  projectSeeds,
  playoffCurve,
  publicTeam,
  clampIterations,
  _invalidateSimulationCache,
  _internals: { buildLeague, runSimulation, makeTiebreaker, seedConference },
};
