
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
  const record = computeRecordFromGames(games, abbr);
  const avg = computeTeamAveragesFromGames(abbr, games);

  // ---------------------------------------------------------------------
  // SOS: average opponent win% across completed games.
  //
  // OLD: sequential `for (const g of completed) { await fetchTeamGames... }`
  //      For 17 completed games this is 17 round-trips serialized end to end.
  // NEW: derive the list of opponent abbreviations, then Promise.all the
  //      schedule fetches. ESPN-side this is one round-trip wide.
  //      Pairs with the promise-level memo cache in services/espn.js so
  //      duplicate opponents (or concurrent rivalimpact requests) don't
  //      re-fetch the same schedule.
  // ---------------------------------------------------------------------
  const opponentAbbrs = games
    .filter((g) => g.completed)
    .map((g) =>
      (g.homeTeamAbbr || "").toUpperCase() === abbr
        ? g.awayTeamAbbr
        : g.homeTeamAbbr
    )
    .filter(Boolean);

  let sos = 0.5;
  if (opponentAbbrs.length > 0) {
    const oppSchedules = await Promise.all(
      opponentAbbrs.map((opp) => fetchTeamGamesSeasonToDate(opp, seasonYear))
    );

    let oppWinPctSum = 0;
    opponentAbbrs.forEach((opp, i) => {
      const oppRec = computeRecordFromGames(oppSchedules[i], opp);
      oppWinPctSum += Number(oppRec.winPct || 0.5);
    });

    sos = oppWinPctSum / opponentAbbrs.length;
  }

  // Components scaled to 0..100
  const offense    = clamp(50 + (avg.avgFor - 21) * 3.0,    0, 100); // 21 baseline
  const defense    = clamp(50 + (21 - avg.avgAgainst) * 3.0, 0, 100); // lower PA = better
  const pointDiff  = clamp(50 + avg.pointDiffPerGame * 5.0,  0, 100);
  const winQuality = clamp(50 + (record.winPct - 0.5) * 120, 0, 100);
  const schedule   = clamp(50 + (sos - 0.5) * 120,           0, 100);

 
  const qbAdj = clamp(0.55 * winQuality + 0.45 * offense, 0, 100);

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
      offense:   Number(offense.toFixed(1)),
      defense:   Number(defense.toFixed(1)),
      pointDiff: Number(pointDiff.toFixed(1)),
      qbAdj:     Number(qbAdj.toFixed(1)),
      schedule:  Number(schedule.toFixed(1)),
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
