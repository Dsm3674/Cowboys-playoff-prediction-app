(function () {
  "use strict";

  function getBaseUrl() {
    return window.BASE_URL || "";
  }

  function buildUrl(path, query) {
    const base = getBaseUrl();
    const url = new URL(path, window.location.origin);
    url.pathname = `${base}${path}`;

    if (query && typeof query === "object") {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        url.searchParams.set(key, String(value));
      });
    }

    return url.pathname + url.search;
  }

  async function requestJson(path, options = {}) {
    const {
      method = "GET",
      query = null,
      body = undefined,
      headers = {}
    } = options;

    const response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get("content-type") || "";
    let payload = null;

    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      const text = await response.text();
      payload = { raw: text };
    }

    if (!response.ok) {
      const message =
        payload?.error ||
        payload?.message ||
        `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function getRecord(year) {
    return requestJson("/api/cowboys/record", {
      query: { year }
    });
  }

  async function getSchedule(year, team) {
    return requestJson("/api/cowboys/schedule", {
      query: { year, team }
    });
  }

  async function getTSI(team, year) {
    return requestJson("/api/analytics/tsi", {
      query: { team, year }
    });
  }

  async function getMustWinGames(team, year) {
    return requestJson("/api/analytics/mustwin", {
      query: { team, year }
    });
  }

  async function getSeasonPaths(team, year) {
    return requestJson("/api/analytics/paths", {
      query: { team, year }
    });
  }

  async function getRivalImpact(year) {
    return requestJson("/api/analytics/rivalimpact", {
      query: { year }
    });
  }

  async function getPlayerEvents(season, limit = 100) {
    return requestJson("/api/players/events", {
      query: { season, limit }
    });
  }

  async function getTimelinePoints(season) {
    return requestJson("/api/timeline/points", {
      query: { season }
    });
  }

  async function getWinProbability(payload) {
    return requestJson("/api/analytics/winprob", {
      method: "POST",
      body: payload
    });
  }

  async function getCacheStats() {
    return requestJson("/api/analytics/cache-stats");
  }

  async function runWhatIfSimulation() {
    throw new Error("What-if simulation has been removed from the live frontend contract.");
  }

  async function generatePrediction() {
    throw new Error("Synthetic prediction generation has been removed from the live frontend contract.");
  }

  async function getCurrentPrediction() {
    throw new Error("Synthetic prediction views have been removed from the live frontend contract.");
  }

  async function getPredictionHistory() {
    throw new Error("Synthetic prediction history has been removed from the live frontend contract.");
  }

  window.api = {
    getBaseUrl,
    requestJson,
    getRecord,
    getSchedule,
    getTSI,
    getMustWinGames,
    getSeasonPaths,
    getRivalImpact,
    getPlayerEvents,
    getTimelinePoints,
    getWinProbability,
    getCacheStats,
    runWhatIfSimulation,
    generatePrediction,
    getCurrentPrediction,
    getPredictionHistory
  };
})();
