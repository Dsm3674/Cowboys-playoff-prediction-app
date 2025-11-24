/**
 * ESPN Cowboys schedule service
 * Robust for current (2025) JSON structure.
 */

async function fetchCowboysGamesSeasonToDate(year) {
  try {
    const fetch = (await import("node-fetch")).default;

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/dal/schedule?season=${year}`;
    console.log(`📡 Fetching Cowboys schedule: ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.error("ESPN API error:", res.status);
      return [];
    }

    const data = await res.json();
    const events = data.events || [];

    // Safe score extraction for 2025+ JSON
    const getScore = (comp) => {
      if (!comp) return 0;

      // 1) score as simple string/number
      if (typeof comp.score === "string" || typeof comp.score === "number") {
        const s = parseInt(comp.score, 10);
        if (!Number.isNaN(s)) return s;
      }

      // 2) score.value pattern
      if (comp.score && comp.score.value != null) {
        const s = parseInt(comp.score.value, 10);
        if (!Number.isNaN(s)) return s;
      }

      // 3) fallback: last linescore
      if (Array.isArray(comp.linescores) && comp.linescores.length > 0) {
        const last = comp.linescores[comp.linescores.length - 1];
        if (last && last.score != null) {
          const s = parseInt(last.score, 10);
          if (!Number.isNaN(s)) return s;
        }
      }

      return 0;
    };

    // Determine if game is completed
    const getCompleted = (statusType = {}) => {
      const desc = (statusType.description || "").toLowerCase();
      const name = (statusType.name || "").toLowerCase();
      const state = (statusType.state || "").toLowerCase();

      if (statusType.completed === true) return true;
      return desc.includes("final") || name.includes("final") || state === "post";
    };

    const allGames = [];

    for (const event of events) {
      const comp = event.competitions && event.competitions[0];
      if (!comp) continue;

      const statusType = comp.status?.type || {};
      const competitors = comp.competitors || [];

      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      const homeTeam = home.team || {};
      const awayTeam = away.team || {};

      allGames.push({
        week: event.week?.number ?? null,
        date: event.date,

        // Raw team objects (useful if needed)
        homeTeam,
        awayTeam,

        // Pre-computed names for the UI
        homeTeamName:
          homeTeam.displayName ||
          homeTeam.name ||
          homeTeam.shortDisplayName ||
          "Home",
        awayTeamName:
          awayTeam.displayName ||
          awayTeam.name ||
          awayTeam.shortDisplayName ||
          "Away",

        // Abbreviations used by computeRecordFromGames
        homeTeamAbbr: homeTeam.abbreviation || null,
        awayTeamAbbr: awayTeam.abbreviation || null,

        // Scores
        homeScore: getScore(home),
        awayScore: getScore(away),

        // Game status
        completed: getCompleted(statusType),
        status: statusType.description || statusType.name || "Scheduled",
      });
    }

    console.log(`✅ Normalized ${allGames.length} games`);
    return allGames;
  } catch (err) {
    console.error("ESPN fetch error:", err);
    return [];
  }
}

/**
 * Compute Cowboys record from normalized games
 */
function computeRecordFromGames(games) {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  if (!Array.isArray(games)) {
    return { wins: 0, losses: 0, ties: 0, winPct: 0, text: "0-0-0" };
  }

  for (const g of games) {
    if (!g || !g.completed) continue;

    const home = g.homeTeamAbbr;
    const away = g.awayTeamAbbr;

    // Skip games that don't involve DAL for any reason
    if (home !== "DAL" && away !== "DAL") continue;

    if (g.homeScore === g.awayScore) {
      ties++;
      continue;
    }

    const cowboysWon =
      (home === "DAL" && g.homeScore > g.awayScore) ||
      (away === "DAL" && g.awayScore > g.homeScore);

    if (cowboysWon) wins++;
    else losses++;
  }

  const total = wins + losses + ties;
  const winPct = total ? Number((wins / total).toFixed(3)) : 0;

  return {
    wins,
    losses,
    ties,
    winPct,
    text: `${wins}-${losses}-${ties}`,
  };
}

module.exports = {
  fetchCowboysGamesSeasonToDate,
  computeRecordFromGames,
};


