
import fetch from "node-fetch";

// Unofficial ESPN endpoints (no auth). See references in README.
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const TEAMS = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";

// Helper: is this the Cowboys in a competition?
const isCowboys = (competitor) =>
  competitor?.team?.abbreviation === "DAL" || competitor?.team?.displayName === "Dallas Cowboys";


export async function fetchCowboysGamesSeasonToDate(year) {
  // ESPN scoreboard defaults to the current week. We’ll sweep a set of weeks (1..23)
  // to cover preseason/postseason if you ever want those later.
  const weeks = Array.from({ length: 23 }, (_, i) => i + 1);
  const seasontype = 2; // 2 = Regular Season

  const requests = weeks.map((week) =>
    fetch(`${SCOREBOARD}?year=${year}&seasontype=${seasontype}&week=${week}`).then((r) => r.json()).catch(() => null)
  );

  const pages = (await Promise.all(requests)).filter(Boolean);

  const events = pages.flatMap((p) => p?.events ?? []);

  // Map each event -> normalized game object if Cowboys involved
  const games = events
    .map((event) => {
      const comp = event?.competitions?.[0];
      if (!comp) return null;

      const competitors = comp.competitors || [];
      const cowboysSide = competitors.find(isCowboys);
      if (!cowboysSide) return null;

      const oppSide = competitors.find((c) => !isCowboys(c));
      const homeAway = cowboysSide.homeAway; // "home" or "away"
      const statusRaw = event?.status?.type?.name || "STATUS_SCHEDULED";

      // Normalize status
      const status =
        statusRaw === "STATUS_FINAL" ? "final"
        : statusRaw === "STATUS_IN_PROGRESS" || statusRaw === "STATUS_HALFTIME" ? "in_progress"
        : "scheduled";

      const teamScore = Number(cowboysSide.score ?? 0);
      const oppScore = Number(oppSide?.score ?? 0);

      let result = null;
      if (status === "final") {
        if (teamScore > oppScore) result = "W";
        else if (teamScore < oppScore) result = "L";
        else result = "T"; // ties!
      }

      return {
        id: event?.id,
        date: event?.date,
        week: comp?.week?.number ?? null,
        status,
        homeAway,
        opponent: oppSide?.team?.displayName || "Unknown",
        teamScore,
        oppScore,
        result,
      };
    })
    .filter(Boolean)
    // Deduplicate by id just in case
    .reduce((acc, g) => {
      if (!acc.find((x) => x.id === g.id)) acc.push(g);
      return acc;
    }, [])
    // Sort by date ascending
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return games;
}


export function computeRecordFromGames(games) {
  let wins = 0, losses = 0, ties = 0;
  for (const g of games) {
    if (g.status !== "final") continue;
    if (g.result === "W") wins++;
    else if (g.result === "L") losses++;
    else if (g.result === "T") ties++;
  }
  return { wins, losses, ties, played: wins + losses + ties };
}
