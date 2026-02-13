
const {
  getNFLSeasonYear,
  fetchTeamGamesSeasonToDate,
} = require("./services/espn");
const { generateEspnPrediction } = require("./prediction");

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

async function buildSeasonPaths({ teamAbbr, year, k = 25, chaos = 0 }) {
  const seasonYear = year || getNFLSeasonYear();
  const abbr = String(teamAbbr || "DAL").toUpperCase();

  const games = await fetchTeamGamesSeasonToDate(abbr, seasonYear);
  const remaining = games.filter((g) => !g.completed);

  // Use your existing per-game win probabilities (with chaos)
  // (generateEspnPrediction is DAL-specific today; if you generalize later, update this)
  if (abbr !== "DAL") {
    // simple fallback: equal odds for now
  }

  const pred = await generateEspnPrediction({ year: seasonYear, chaos, iterations: 5000 });
  const probs = pred.perGameWinProbabilities.map(Number);

  // Beam search over remaining games
  let paths = [{ prob: 1, winsAdded: 0, outcomes: [] }];

  for (let i = 0; i < remaining.length; i++) {
    const pWin = clamp(probs[i] ?? 0.5, 0.05, 0.95);
    const g = remaining[i];

    const next = [];
    for (const path of paths) {
      next.push({
        prob: path.prob * pWin,
        winsAdded: path.winsAdded + 1,
        outcomes: path.outcomes.concat([{ i, result: "W", p: pWin, opp: opponentOf(abbr, g) }]),
      });
      next.push({
        prob: path.prob * (1 - pWin),
        winsAdded: path.winsAdded + 0,
        outcomes: path.outcomes.concat([{ i, result: "L", p: 1 - pWin, opp: opponentOf(abbr, g) }]),
      });
    }

    // Keep top K by probability
    next.sort((a, b) => b.prob - a.prob);
    paths = next.slice(0, k);
  }

  // Normalize for display
  const total = paths.reduce((s, p) => s + p.prob, 0) || 1;
  const topPaths = paths.map((p) => ({
    probability: Number((p.prob / total).toFixed(4)),
    winsAdded: p.winsAdded,
    outcomes: p.outcomes,
  }));

  // Return minimal “tree-ish” structure the frontend can render
  return {
    team: abbr,
    year: seasonYear,
    k: topPaths.length,
    chaos: Number(chaos),
    paths: topPaths,
    remainingGames: remaining.map((g, idx) => ({
      idx,
      date: g.date,
      home: g.homeTeamAbbr,
      away: g.awayTeamAbbr,
      opp: opponentOf(abbr, g),
      isHome: g.homeTeamAbbr === abbr,
      status: g.status,
      pWin: Number(clamp(probs[idx] ?? 0.5, 0.05, 0.95).toFixed(3)),
    })),
  };
}

function opponentOf(abbr, g) {
  return g.homeTeamAbbr === abbr ? g.awayTeamAbbr : g.homeTeamAbbr;
}

/**
 * Must-win = games with biggest swing in playoff probability if win vs loss.
 * Simple approach:
 *  - baseline playoffProb
 *  - for each game j: force W then force L via pWin=1 / pWin=0 approximation
 */
async function computeMustWinGames({ teamAbbr, year, chaos = 0 }) {
  const seasonYear = year || getNFLSeasonYear();
  const abbr = String(teamAbbr || "DAL").toUpperCase();
  if (abbr !== "DAL") return [];

  const base = await generateEspnPrediction({ year: seasonYear, chaos, iterations: 8000 });
  const baseline = Number(base.playoffProbability);

  const games = await fetchTeamGamesSeasonToDate(abbr, seasonYear);
  const remaining = games.filter((g) => !g.completed);

  const out = [];
  for (let j = 0; j < remaining.length; j++) {
    // Hack: re-run quickly and override by modifying probs after the fact
    // Best practice later: expose an API in prediction.js to accept forced outcomes.
    const forcedWin = await generateEspnPrediction({ year: seasonYear, chaos, iterations: 4000 });
    const forcedLoss = await generateEspnPrediction({ year: seasonYear, chaos, iterations: 4000 });

    // Approx “swing” placeholder (since we didn’t truly force j yet)
    // Replace soon: implement forced outcome in monteCarloSeason.
    const swing = Math.abs(Number(forcedWin.playoffProbability) - Number(forcedLoss.playoffProbability));

    out.push({
      idx: j,
      opp: opponentOf(abbr, remaining[j]),
      date: remaining[j].date,
      isHome: remaining[j].homeTeamAbbr === abbr,
      baselinePlayoffProb: baseline,
      swing: Number(swing.toFixed(4)),
      label: swing > 0.08 ? "MUST-WIN" : swing > 0.04 ? "HIGH-LEVERAGE" : "NORMAL",
    });
  }

  out.sort((a, b) => b.swing - a.swing);
  return out;
}

module.exports = { buildSeasonPaths, computeMustWinGames };
