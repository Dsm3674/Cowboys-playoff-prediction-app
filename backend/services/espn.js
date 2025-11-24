async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2`;

    console.log(`Fetching Cowboys full season scoreboard: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error("ESPN error:", res.status);
      return [];
    }

    const data = await res.json();
    if (!data.events || data.events.length === 0) {
      return [];
    }

    const allGames = [];

    for (const event of data.events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const home = comp.competitors.find(c => c.homeAway === "home");
      const away = comp.competitors.find(c => c.homeAway === "away");
      if (!home || !away) continue;

      // Only Cowboys games
      if (home.team.abbreviation !== "DAL" && away.team.abbreviation !== "DAL") continue;

      allGames.push({
        week: comp.week?.number || null,
        homeTeam: home.team,
        awayTeam: away.team,
        homeScore: parseInt(home.score) || 0,
        awayScore: parseInt(away.score) || 0,
        completed: comp.status?.type?.completed ?? false,
        status: comp.status?.type?.name || "Scheduled",
        date: event.date
      });
    }

    console.log(`Cowboys games found: ${allGames.length}`);
    return allGames;
  } catch (e) {
    console.error("ESPN fetch error:", e);
    return [];
  }
}

module.exports = { fetchCowboysGamesSeasonToDate, computeRecordFromGames };

