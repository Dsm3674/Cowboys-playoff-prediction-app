function getNFLSeasonYear() {
  const now = new Date();
  const month = now.getMonth(); // Jan = 0
  return month < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

let _teamMapCache = null;
let _teamMapCacheTs = 0;

async function getNflTeamIdMap() {
  // cache for 24h
  const now = Date.now();
  if (_teamMapCache && now - _teamMapCacheTs < 24 * 60 * 60 * 1000) {
    return _teamMapCache;
  }

  const fetch = (await import("node-fetch")).default;

  // ESPN teams list
  const url =
    "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
  const res = await fetch(url);
  if (!res.ok) {
    _teamMapCache = {};
    _teamMapCacheTs = now;
    return _teamMapCache;
  }

  const data = await res.json();

  // ESPN structure: sports[0].leagues[0].teams is common
  let teams = [];
  if (Array.isArray(data.sports) && data.sports[0]?.leagues?.[0]?.teams) {
    teams = data.sports[0].leagues[0].teams;
  } else if (Array.isArray(data.leagues) && data.leagues[0]?.teams) {
    teams = data.leagues[0].teams;
  } else if (Array.isArray(data.teams)) {
    teams = data.teams;
  }

  const map = {};
  teams.forEach((tWrap) => {
    const t = tWrap.team || tWrap;
    const abbr = (t.abbreviation || "").toUpperCase();
    const id = t.id;
    if (abbr && id) map[abbr] = String(id);
  });

  _teamMapCache = map;
  _teamMapCacheTs = now;
  return map;
}

function parseEspnScheduleEvents(events = []) {
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
    type.completed === true || (type.state || "").toLowerCase() === "post";

  return events
    .map((event) => {
      const comp = event.competitions?.[0];
      if (!comp) return null;

      const home = comp.competitors?.find((c) => c.homeAway === "home");
      const away = comp.competitors?.find((c) => c.homeAway === "away");

      if (!home || !away) return null;

      return {
        week: event.week?.number ?? null,
        date: event.date,
        homeTeamName: home.team?.displayName ?? "Home",
        awayTeamName: away.team?.displayName ?? "Away",
        homeTeamAbbr: home.team?.abbreviation,
        awayTeamAbbr: away.team?.abbreviation,
        homeScore: getScore(home),
        awayScore: getScore(away),
        completed: isCompleted(comp.status?.type),
        status: comp.status?.type?.description ?? "Scheduled",
      };
    })
    .filter(Boolean);
}

async function fetchTeamGamesSeasonToDate(teamAbbr, year = getNFLSeasonYear()) {
  try {
    const fetch = (await import("node-fetch")).default;
    const map = await getNflTeamIdMap();
    const abbr = String(teamAbbr || "").toUpperCase();
    const teamId = map[abbr];

    // fallback: old style teams/dal (works for DAL, sometimes others)
    if (!teamId) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr.toLowerCase()}/schedule?season=${year}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return parseEspnScheduleEvents(data.events || []);
    }

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule?season=${year}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return parseEspnScheduleEvents(data.events || []);
  } catch (err) {
    console.error("ESPN fetch error:", err);
    return [];
  }
}

async function fetchCowboysGamesSeasonToDate(year = getNFLSeasonYear()) {
  return fetchTeamGamesSeasonToDate("DAL", year);
}

/* ✅ compute record from games */
function computeRecordFromGames(games) {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  games.forEach((g) => {
    if (!g.completed) return;

    if (g.homeScore === g.awayScore) {
      ties++;
      return;
    }

    const cowboysHome = g.homeTeamAbbr === "DAL";
    const cowboysScore = cowboysHome ? g.homeScore : g.awayScore;
    const oppScore = cowboysHome ? g.awayScore : g.homeScore;

    if (cowboysScore > oppScore) wins++;
    else losses++;
  });

  const total = wins + losses + ties;

  return {
    wins,
    losses,
    ties,
    winPct: total ? wins / total : 0,
  };
}

function computeTeamAveragesFromGames(teamAbbr, games) {
  const abbr = String(teamAbbr || "").toUpperCase();
  const completed = (games || []).filter((g) => g.completed);

  let pf = 0;
  let pa = 0;

  completed.forEach((g) => {
    const isHome = (g.homeTeamAbbr || "").toUpperCase() === abbr;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    pf += teamScore;
    pa += oppScore;
  });

  const gp = completed.length || 0;
  return {
    gamesPlayed: gp,
    avgFor: gp ? pf / gp : 21,
    avgAgainst: gp ? pa / gp : 21,
    pointDiffPerGame: gp ? (pf - pa) / gp : 0,
  };
}

module.exports = {
  getNFLSeasonYear,
  fetchTeamGamesSeasonToDate,
  fetchCowboysGamesSeasonToDate,
  computeRecordFromGames,
  computeTeamAveragesFromGames,
};

