async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;

    // ✅ FIX: Use the team-specific endpoint instead of scoreboard
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal/schedule?season=${year}`;
    console.log(`Fetching Cowboys schedule: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error("ESPN API error:", res.status);
      return [];
    }

    const data = await res.json();
    
    // Handle the different response structure
    const events = data.events || [];
    if (events.length === 0) {
      console.log("No games found for Cowboys");
      return [];
    }

    const allGames = [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors.find(c => c.homeAway === "home");
      const away = comp.competitors.find(c => c.homeAway === "away");
      if (!home || !away) continue;

      allGames.push({
        week: event.week?.number || null,
        homeTeam: home.team,
        awayTeam: away.team,
        homeScore: parseInt(home.score) || 0,
        awayScore: parseInt(away.score) || 0,
        completed: comp.status?.type?.completed ?? false,
        status: comp.status?.type?.name || "Scheduled",
        date: event.date
      });
    }

    console.log(`✅ Found ${allGames.length} Cowboys games`);
    return allGames;
  } catch (e) {
    console.error("ESPN fetch error:", e);
    return [];
  }
}

// ===============================
// RESTORE THIS FUNCTION (Required)
// ===============================
function computeRecordFromGames(games) {
  let wins = 0, losses = 0, ties = 0;

  if (!games || !games.length) {
    return { wins: 0, losses: 0, ties: 0, winPct: 0, text: "0-0-0" };
  }

  for (const game of games) {
    if (!game.completed) continue;

    const isDalHome = game.homeTeam.abbreviation === "DAL";
    const isDalAway = game.awayTeam.abbreviation === "DAL";

    if (isDalHome) {
      if (game.homeScore > game.awayScore) wins++;
      else if (game.homeScore < game.awayScore) losses++;
      else ties++;
    } else if (isDalAway) {
      if (game.awayScore > game.homeScore) wins++;
      else if (game.awayScore < game.homeScore) losses++;
      else ties++;
    }
  }

  const total = wins + losses + ties;
  const winPct = total ? Number((wins / total).toFixed(3)) : 0;

  return {
    wins,
    losses,
    ties,
    winPct,
    text: `${wins}-${losses}-${ties}`
  };
}

// Export BOTH functions
module.exports = {
  fetchCowboysGamesSeasonToDate,
  computeRecordFromGames
};
