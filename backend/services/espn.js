function getNFLSeasonYear() {
  const now = new Date();
  const month = now.getMonth(); // Jan = 0
  return month < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

const NFL_TEAM_CATALOG = [
  { abbreviation: "ARI", displayName: "Arizona Cardinals", conference: "NFC", division: "NFC West" },
  { abbreviation: "ATL", displayName: "Atlanta Falcons", conference: "NFC", division: "NFC South" },
  { abbreviation: "BAL", displayName: "Baltimore Ravens", conference: "AFC", division: "AFC North" },
  { abbreviation: "BUF", displayName: "Buffalo Bills", conference: "AFC", division: "AFC East" },
  { abbreviation: "CAR", displayName: "Carolina Panthers", conference: "NFC", division: "NFC South" },
  { abbreviation: "CHI", displayName: "Chicago Bears", conference: "NFC", division: "NFC North" },
  { abbreviation: "CIN", displayName: "Cincinnati Bengals", conference: "AFC", division: "AFC North" },
  { abbreviation: "CLE", displayName: "Cleveland Browns", conference: "AFC", division: "AFC North" },
  { abbreviation: "DAL", displayName: "Dallas Cowboys", conference: "NFC", division: "NFC East" },
  { abbreviation: "DEN", displayName: "Denver Broncos", conference: "AFC", division: "AFC West" },
  { abbreviation: "DET", displayName: "Detroit Lions", conference: "NFC", division: "NFC North" },
  { abbreviation: "GB", displayName: "Green Bay Packers", conference: "NFC", division: "NFC North" },
  { abbreviation: "HOU", displayName: "Houston Texans", conference: "AFC", division: "AFC South" },
  { abbreviation: "IND", displayName: "Indianapolis Colts", conference: "AFC", division: "AFC South" },
  { abbreviation: "JAX", displayName: "Jacksonville Jaguars", conference: "AFC", division: "AFC South" },
  { abbreviation: "KC", displayName: "Kansas City Chiefs", conference: "AFC", division: "AFC West" },
  { abbreviation: "LV", displayName: "Las Vegas Raiders", conference: "AFC", division: "AFC West" },
  { abbreviation: "LAC", displayName: "Los Angeles Chargers", conference: "AFC", division: "AFC West" },
  { abbreviation: "LAR", displayName: "Los Angeles Rams", conference: "NFC", division: "NFC West" },
  { abbreviation: "MIA", displayName: "Miami Dolphins", conference: "AFC", division: "AFC East" },
  { abbreviation: "MIN", displayName: "Minnesota Vikings", conference: "NFC", division: "NFC North" },
  { abbreviation: "NE", displayName: "New England Patriots", conference: "AFC", division: "AFC East" },
  { abbreviation: "NO", displayName: "New Orleans Saints", conference: "NFC", division: "NFC South" },
  { abbreviation: "NYG", displayName: "New York Giants", conference: "NFC", division: "NFC East" },
  { abbreviation: "NYJ", displayName: "New York Jets", conference: "AFC", division: "AFC East" },
  { abbreviation: "PHI", displayName: "Philadelphia Eagles", conference: "NFC", division: "NFC East" },
  { abbreviation: "PIT", displayName: "Pittsburgh Steelers", conference: "AFC", division: "AFC North" },
  { abbreviation: "SEA", displayName: "Seattle Seahawks", conference: "NFC", division: "NFC West" },
  { abbreviation: "SF", displayName: "San Francisco 49ers", conference: "NFC", division: "NFC West" },
  { abbreviation: "TB", displayName: "Tampa Bay Buccaneers", conference: "NFC", division: "NFC South" },
  { abbreviation: "TEN", displayName: "Tennessee Titans", conference: "AFC", division: "AFC South" },
  { abbreviation: "WAS", displayName: "Washington Commanders", conference: "NFC", division: "NFC East" }
];

function normalizeTeamAbbr(teamAbbr, fallback = "DAL") {
  const raw = String(teamAbbr || "").trim().toUpperCase();
  return raw || fallback;
}

function getNFLCatalogItem(teamAbbr) {
  const abbr = normalizeTeamAbbr(teamAbbr);
  return NFL_TEAM_CATALOG.find((item) => item.abbreviation === abbr) || null;
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
  let teams =[];
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
    const name = t.displayName || t.location || t.name || abbr;
    if (abbr && id) map[abbr] = { id: String(id), name };
  });

  _teamMapCache = map;
  _teamMapCacheTs = now;
  return _teamMapCache;
}

async function getNFLTeamList() {
  const map = await getNflTeamIdMap();
  const result = Object.keys(map)
    .sort()
    .map((abbr) => {
      const metadata = getNFLCatalogItem(abbr);
      return {
        code: abbr,
        name: map[abbr]?.name || metadata?.displayName || abbr,
        conference: metadata?.conference || null,
        division: metadata?.division || null
      };
    });

  if (result.length > 0) return result;

  return NFL_TEAM_CATALOG.map((item) => ({
    code: item.abbreviation,
    name: item.displayName,
    conference: item.conference,
    division: item.division
  }));
}

function parseEspnScheduleEvents(events =[]) {
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
        id: event.id, // Included for fetching deep play-by-play logs
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
    const teamId = map[abbr]?.id;

    // fallback: old style teams/dal (works for DAL, sometimes others)
    if (!teamId) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbr.toLowerCase()}/schedule?season=${year}`;
      const res = await fetch(url);
      if (!res.ok) return[];
      const data = await res.json();
      return parseEspnScheduleEvents(data.events ||[]);
    }

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule?season=${year}`;
    const res = await fetch(url);
    if (!res.ok) return[];
    const data = await res.json();
    return parseEspnScheduleEvents(data.events ||[]);
  } catch (err) {
    console.error("ESPN fetch error:", err);
    return[];
  }
}

async function fetchCowboysGamesSeasonToDate(year = getNFLSeasonYear()) {
  return fetchTeamGamesSeasonToDate("DAL", year);
}

function computeRecordFromGames(games, teamAbbr = "DAL") {
  const abbr = String(teamAbbr || "DAL").toUpperCase();

  let wins = 0;
  let losses = 0;
  let ties = 0;

  games.forEach((g) => {
    if (!g.completed) return;

    if (g.homeScore === g.awayScore) {
      ties++;
      return;
    }

    const teamIsHome = (g.homeTeamAbbr || "").toUpperCase() === abbr;
    const teamScore = teamIsHome ? g.homeScore : g.awayScore;
    const oppScore  = teamIsHome ? g.awayScore : g.homeScore;

    if (teamScore > oppScore) wins++;
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
  const completed = (games ||[]).filter((g) => g.completed);

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
  getNFLTeamList,
  getNFLTeamCatalog: () => NFL_TEAM_CATALOG,
  getNFLTeamMetadata: getNFLCatalogItem,
  normalizeTeamAbbr,
};
