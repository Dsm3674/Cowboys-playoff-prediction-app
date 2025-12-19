function getNFLSeasonYear() {
  const now = new Date();
  const month = now.getMonth(); // Jan = 0
  return month < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchCowboysGamesSeasonToDate(year = getNFLSeasonYear()) {
  try {
    const fetch = (await import("node-fetch")).default;

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal/schedule?season=${year}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const events = data.events || [];

    const getScore = (comp) => {
      if (!comp) return 0;
      if (comp.score?.value != null) return Number(comp.score.value);
      if (Array.isArray(comp.linescores)) {
        const last = comp.linescores.at(-1);
        if (last?.score != null) return Number(last.score);
      }
      return 0;
    };

    const isCompleted = (type = {}) =>
      type.completed === true ||
      (type.state || '').toLowerCase() === 'post';

    return events.map((event) => {
      const comp = event.competitions?.[0];
      if (!comp) return null;

      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');

      if (!home || !away) return null;

      return {
        week: event.week?.number ?? null,
        date: event.date,
        homeTeamName: home.team?.displayName ?? 'Home',
        awayTeamName: away.team?.displayName ?? 'Away',
        homeTeamAbbr: home.team?.abbreviation,
        awayTeamAbbr: away.team?.abbreviation,
        homeScore: getScore(home),
        awayScore: getScore(away),
        completed: isCompleted(comp.status?.type),
        status: comp.status?.type?.description ?? 'Scheduled'
      };
    }).filter(Boolean);
  } catch (err) {
    console.error("ESPN fetch error:", err);
    return [];
  }
}

module.exports = {
  fetchCowboysGamesSeasonToDate
};

