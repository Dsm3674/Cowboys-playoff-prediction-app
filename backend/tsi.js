
const {
  getNFLSeasonYear,
  fetchTeamGamesSeasonToDate,
  computeTeamAveragesFromGames,
  computeRecordFromGames,
} = require("./services/espn");

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

async function computeTSI({ teamAbbr, year }) {
  const seasonYear = year || getNFLSeasonYear();
  const abbr = String(teamAbbr || "DAL").toUpperCase();

  const games = await fetchTeamGamesSeasonToDate(abbr, seasonYear);
  const record = computeRecordFromGames(games);
  const avg = computeTeamAveragesFromGames(abbr, games);

  // SOS: average opponent win% from completed games only
  const completed = games.filter((g) => g.completed);
  let oppWinPctSum = 0;
  let oppCount = 0;

  for (const g of completed) {
    const oppAbbr = g.homeTeamAbbr === abbr ? g.awayTeamAbbr : g.homeTeamAbbr;
    const oppGames = await fetchTeamGamesSeasonToDate(oppAbbr, seasonYear);
    const oppRec = computeRecordFromGames(oppGames);
    oppWinPctSum += Number(oppRec.winPct || 0.5);
    oppCount++;
  }

  const sos = oppCount ? oppWinPctSum / oppCount : 0.5;

  // Components scaled to 0..100
  const offense = clamp(50 + (avg.avgFor - 21) * 3.0, 0, 100);      // 21 baseline
  const defense = clamp(50 + (21 - avg.avgAgainst) * 3.0, 0, 100);  // lower PA = better
  const pointDiff = clamp(50 + avg.pointDiffPerGame * 5.0, 0, 100);
  const winQuality = clamp(50 + (record.winPct - 0.5) * 120, 0, 100);
  const schedule = clamp(50 + (sos - 0.5) * 120, 0, 100);

  // QB adjusted performance: placeholder (hook later)
  // For now: blend win pct + offense as a proxy
  const qbAdj = clamp(0.55 * winQuality + 0.45 * offense, 0, 100);

  // Final composite (weights you can tweak)
  const tsi =
    0.22 * offense +
    0.22 * defense +
    0.18 * pointDiff +
    0.18 * qbAdj +
    0.20 * schedule;

  return {
    team: abbr,
    year: seasonYear,
    tsi: Number(tsi.toFixed(1)),
    components: {
      offense: Number(offense.toFixed(1)),
      defense: Number(defense.toFixed(1)),
      pointDiff: Number(pointDiff.toFixed(1)),
      qbAdj: Number(qbAdj.toFixed(1)),
      schedule: Number(schedule.toFixed(1)),
      sosWinPct: Number(sos.toFixed(3)),
    },
    meta: {
      gamesPlayed: avg.gamesPlayed,
      record,
      generatedAt: new Date().toISOString(),
    },
  };
}

module.exports = { computeTSI };
