  const envBase = import.meta.env.VITE_API_BASE_URL;
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const BASE = envBase || (isLocal ? "" : window.location.origin);

  export const BASE_URL = BASE;

  function buildQuery(params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      query.set(key, String(value));
    });

    const out = query.toString();
    return out ? `?${out}` : "";
  }

  async function parseResponse(res) {
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return res.json();
    }

    const text = await res.text();
    return { raw: text };
  }

  const AUTH_KEY = "cowboys_iq_auth_v3";
  const HISTORY_COOKIE = "lsi_history";
  const USER_COOKIE = "lsi_user";

  function isGmail(email) {
    return /^[^@\s]+@gmail\.com$/i.test(String(email || "").trim());
  }

  function isAnonId(user) {
    return /^anon-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/i.test(String(user || "").trim());
  }

  function isKnownUser(user) {
    return isGmail(user) || isAnonId(user);
  }

  function readCookie(name) {
    if (typeof document === "undefined") return "";
    const prefix = `${name}=`;
    const match = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : "";
  }

  function writeCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 365) {
    if (typeof document === "undefined" || !value) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
  }

  function makeHistoryId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function ensureHistoryId() {
    if (typeof window === "undefined") return "";

    let historyId = readCookie(HISTORY_COOKIE) || localStorage.getItem(HISTORY_COOKIE);
    if (!historyId) {
      historyId = makeHistoryId();
    }

    localStorage.setItem(HISTORY_COOKIE, historyId);
    writeCookie(HISTORY_COOKIE, historyId);
    return historyId;
  }

  function getSignedInUser() {
    try {
      const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (isKnownUser(stored?.user)) {
        const user = stored.user.trim().toLowerCase();
        writeCookie(USER_COOKIE, user);
        return user;
      }
    } catch (_err) {
      // Ignore malformed legacy auth data and fall back to the cookie.
    }

    const cookieUser = readCookie(USER_COOKIE);
    return isKnownUser(cookieUser) ? cookieUser.trim().toLowerCase() : "";
  }

  function getIdentityHeaders() {
    const historyId = ensureHistoryId();
    const user = getSignedInUser();

    return {
      ...(historyId ? { "X-LoneStar-History-Id": historyId } : {}),
      ...(user ? { "X-LoneStar-User": user } : {})
    };
  }

  async function request(path, options = {}) {
    const {
      method = "GET",
      query = null,
      body = undefined,
      headers = {}
    } = options;

    const url = `${BASE}${path}${query ? buildQuery(query) : ""}`;

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...getIdentityHeaders(),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const payload = await parseResponse(res);

    if (!res.ok) {
      const message =
        payload?.error ||
        payload?.message ||
        `${method} ${path} failed with status ${res.status}`;

      const err = new Error(message);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  async function tryRequest(candidates) {
    let lastError = null;

    for (const candidate of candidates) {
      try {
        return await request(candidate.path, candidate.options || {});
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("All request candidates failed.");
  }

  async function getCowboysRecord(year) {
    return request("/api/teams/DAL/record", {
      query: { year }
    });
  }

  async function getRecord(year, team = "DAL") {
    return request(`/api/teams/${team}/record`, {
      query: { year }
    });
  }

  async function getCowboysSchedule(year) {
    return request("/api/teams/DAL/schedule", {
      query: { year }
    });
  }

  async function getSchedule(year, team = "DAL") {
    return request(`/api/teams/${team}/schedule`, {
      query: { year }
    });
  }

  async function getTSI(team, year) {
    return request(`/api/teams/${team}/tsi`, {
      query: { year }
    });
  }

  async function getPaths(team, year, k = 25, chaos = 0) {
    return request(`/api/teams/${team}/paths`, {
      query: { year, k, chaos }
    });
  }

  async function getSeasonPaths(team, year, k = 25, chaos = 0) {
    return getPaths(team, year, k, chaos);
  }

  async function getMustWin(team, year, chaos = 0) {
    return request(`/api/teams/${team}/mustwin`, {
      query: { year, chaos }
    });
  }

  async function getMustWinGames(team, year, chaos = 0) {
    return getMustWin(team, year, chaos);
  }

  async function getWinProb(payload) {
    return request("/api/analytics/winprob", {
      method: "POST",
      body: payload
    });
  }

  async function getWinProbability(payload) {
    return getWinProb(payload);
  }

  async function getRivalImpact(team = "DAL", year, chaos = 0, iterations = 1000) {
    const query = { team, year, chaos, iterations };

    return tryRequest([
      {
        path: "/api/analytics/rivalimpact",
        options: { query }
      },
      {
        path: "/api/analytics/rivalimpact",
        options: { query: { team, year } }
      }
    ]);
  }

  async function getTeams() {
    return request("/api/analytics/teams");
  }

  async function getStandings(year) {
    return request("/api/analytics/standings", {
      query: { year }
    });
  }

  async function getDivisionPower(year) {
    return request("/api/analytics/divisions", {
      query: { year }
    });
  }

  async function getLeagueForecast(year) {
    return request("/api/analytics/forecast", {
      query: { year }
    });
  }

  async function getPlayoffPulse(year) {
    return request("/api/analytics/playoff", {
      query: { year }
    });
  }

  async function getPlayoffBracket(year) {
    return request("/api/analytics/bracket", {
      query: { year }
    });
  }

  async function getScheduleStrength(year) {
    return request("/api/analytics/schedule-strength", {
      query: { year }
    });
  }

  async function getMatchup(team1 = "DAL", team2 = "PHI", year) {
    return request("/api/analytics/matchup", {
      query: { team1, team2, year }
    });
  }

  async function getTeamComparison(team1 = "DAL", team2 = "PHI", year) {
    return request("/api/analytics/compare", {
      query: { team1, team2, year }
    });
  }

  async function getPlayerMaps() {
    return request("/api/players/maps");
  }

  async function getPlayerRadar(season) {
    return request("/api/players/radar", {
      query: { season }
    });
  }

  async function getClutchIndex(season) {
    return request("/api/players/clutch", {
      query: { season }
    });
  }

  async function getPlayerEvents(season, limit = 100) {
    return request("/api/players/events", {
      query: { season, limit }
    });
  }

  async function getTimelinePoints(season) {
    return request("/api/timeline/points", {
      query: { season }
    });
  }

  async function getTimelineFull(season) {
    return request("/api/timeline/full", {
      query: { season }
    });
  }

  async function getCacheStats() {
    return request("/api/analytics/cache-stats");
  }

  async function generatePrediction() {
    return tryRequest([
      {
        path: "/api/prediction/generate",
        options: { method: "POST" }
      },
      {
        path: "/api/predictions/generate",
        options: { method: "POST" }
      }
    ]);
  }

  async function getCurrentPrediction() {
    return tryRequest([
      {
        path: "/api/prediction/current"
      },
      {
        path: "/api/predictions/current"
      }
    ]);
  }

  async function getPredictionHistory() {
    return tryRequest([
      {
        path: "/api/prediction/history"
      },
      {
        path: "/api/predictions/history"
      }
    ]);
  }

  async function runWhatIfSimulation(payload) {
    return tryRequest([
      {
        path: "/api/simulation/run",
        options: {
          method: "POST",
          body: payload
        }
      },
      {
        path: "/api/prediction/simulate",
        options: {
          method: "POST",
          body: payload
        }
      }
    ]);
  }


  // ── War Room (Pro): prediction market + chatbot ──────────────

  function getWarRoomStatus() {
    return request("/api/warroom/status");
  }

  function getWarRoomMarkets() {
    return request("/api/warroom/markets");
  }

  function placeWarRoomBet(marketId, side, amount) {
    return request(`/api/warroom/markets/${marketId}/bet`, {
      method: "POST",
      body: { side, amount }
    });
  }

  function getWarRoomLeaderboard() {
    return request("/api/warroom/leaderboard");
  }

  function sendWarRoomChat(messages) {
    return request("/api/warroom/chat", {
      method: "POST",
      body: { messages }
    });
  }

  function claimSeasonReward(wins) {
    return request("/api/warroom/season/reward", {
      method: "POST",
      body: { wins }
    });
  }

  function startProCheckout() {
    return request("/api/billing/create-checkout-session", {
      method: "POST",
      body: { plan: "War Room Pro", email: getSignedInUser() }
    });
  }

  export const api = {
    getCowboysRecord,
    getRecord,
    getCowboysSchedule,
    getSchedule,
    getTSI,
    getPaths,
    getSeasonPaths,
    getMustWin,
    getMustWinGames,
    getWinProb,
    getWinProbability,
    getRivalImpact,
    getTeams,
    getStandings,
    getDivisionPower,
    getLeagueForecast,
    getPlayoffPulse,
    getPlayoffBracket,
    getScheduleStrength,
    getMatchup,
    getTeamComparison,
    getPlayerMaps,
    getPlayerRadar,
    getClutchIndex,
    getPlayerEvents,
    getTimelinePoints,
    getTimelineFull,
    getCacheStats,
    generatePrediction,
    getCurrentPrediction,
    getPredictionHistory,
    runWhatIfSimulation,
    getWarRoomStatus,
    getWarRoomMarkets,
    placeWarRoomBet,
    getWarRoomLeaderboard,
    sendWarRoomChat,
    claimSeasonReward,
    startProCheckout
  };
