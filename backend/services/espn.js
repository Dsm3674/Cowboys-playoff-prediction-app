async function fetchCowboysGamesSeasonToDate(year) {
  const fetch = (await import("node-fetch")).default;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal/schedule?season=${year}`);
  const data = await res.json();
  return data.events.map(e => ({
    homeTeam: e.competitions[0].competitors.find(c => c.homeAway === "home").team,
    awayTeam: e.competitions[0].competitors.find(c => c.homeAway === "away").team,
    homeScore: Number(e.competitions[0].competitors.find(c => c.homeAway === "home").score),
    awayScore: Number(e.competitions[0].competitors.find(c => c.homeAway === "away").score),
  }));
}

function computeRecordFromGames(games) {
  let wins = 0, losses = 0, ties = 0;
  for (const g of games) {
    if (g.homeTeam.abbreviation === "DAL") {
      if (g.homeScore > g.awayScore) wins++;
      else if (g.homeScore < g.awayScore) losses++;
      else ties++;
    } else if (g.awayTeam.abbreviation === "DAL") {
      if (g.awayScore > g.homeScore) wins++;
      else if (g.awayScore < g.homeScore) losses++;
      else ties++;
    }
  }
  const total = wins + losses + ties;
  const winPct = total ? Number((wins / total).toFixed(3)) : 0;
  return { wins, losses, ties, winPct, text: `${wins}-${losses}-${ties}` };
}

module.exports = { fetchCowboysGamesSeasonToDate, computeRecordFromGames };

