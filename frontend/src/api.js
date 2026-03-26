(function () {
  "use strict";

  const BASE =
    window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : window.location.origin;

  window.BASE_URL = BASE;

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
    return request("/api/cowboys/record", {
      query: { year }
    });
  }

  async function getRecord(year) {
    return getCowboysRecord(year);
  }

  async function getCowboysSchedule(year) {
    return request("/api/cowboys/schedule", {
      query: { year }
    });
  }

  async function getSchedule(year, team) {
    return request("/api/cowboys/schedule", {
      query: { year, team }
    });
  }

  async function getTSI(team, year) {
    return request("/api/analytics/tsi", {
      query: { team, year }
    });
  }

  async function getPaths(team, year, k = 25, chaos = 0) {
    return request("/api/analytics/paths", {
      query: { team, year, k, chaos }
    });
  }

  async function getSeasonPaths(team, year, k = 25, chaos = 0) {
    return getPaths(team, year, k, chaos);
  }

  async function getMustWin(team, year, chaos = 0) {
    return request("/api/analytics/mustwin", {
      query: { team, year, chaos }
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

  async function getRivalImpact(year, chaos = 0, iterations = 1000) {
    return tryRequest([
      {
        path: "/api/analytics/rivalimpact",
        options: {
          query: { year, chaos, iterations }
        }
      },
      {
        path: "/api/analytics/rivalimpact",
        options: {
          query: { year }
        }
      }
    ]);
  }

  async function getPlayerMaps() {
    return request("/api/players/maps");
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

  window.api = {
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
    getPlayerMaps,
    getClutchIndex,
    getPlayerEvents,
    getTimelinePoints,
    getCacheStats,
    generatePrediction,
    getCurrentPrediction,
    getPredictionHistory,
    runWhatIfSimulation
  };
})();
