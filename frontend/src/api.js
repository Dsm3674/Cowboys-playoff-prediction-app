const BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin;

window.api = {
  getCowboysRecord: async (year) => {
    const res = await fetch(`${BASE}/api/cowboys/record?year=${year}`);
    if (!res.ok) throw new Error("record fetch failed");
    return res.json();
  },

  getCowboysSchedule: async (year) => {
    const res = await fetch(`${BASE}/api/cowboys/schedule?year=${year}`);
    if (!res.ok) throw new Error("schedule fetch failed");
    return res.json();
  },

  generatePrediction: async () => {
    const res = await fetch(`${BASE}/api/prediction/generate`, { method: "POST" });
    if (!res.ok) throw new Error("prediction generation failed");
    return res.json();
  },

  getCurrentPrediction: async () => {
    const res = await fetch(`${BASE}/api/prediction/current`);
    if (!res.ok) throw new Error("prediction fetch failed");
    return res.json();
  },

  getPredictionHistory: async () => {
    const res = await fetch(`${BASE}/api/prediction/history`);
    if (!res.ok) throw new Error("history fetch failed");
    return res.json();
  },

  runWhatIfSimulation: async (payload) => {
    const res = await fetch(`${BASE}/api/simulation/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("simulation failed");
    return res.json();
  }
};
