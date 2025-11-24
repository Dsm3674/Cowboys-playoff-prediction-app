const BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin;

window.getCowboysRecord = async function (year) {
  const res = await fetch(`${BASE}/api/cowboys/record?year=${year}`);
  if (!res.ok) throw new Error("record fetch failed");
  return res.json();
};

window.getCowboysSchedule = async function (year) {
  const res = await fetch(`${BASE}/api/cowboys/schedule?year=${year}`);
  if (!res.ok) throw new Error("schedule fetch failed");
  return res.json();
};

window.generatePrediction = async function () {
  const res = await fetch(`${BASE}/api/prediction/generate`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("prediction generation failed");
  return res.json();
};

window.getCurrentPrediction = async function () {
  const res = await fetch(`${BASE}/api/prediction/current`);
  if (!res.ok) throw new Error("prediction fetch failed");
  return res.json();
};

window.getPredictionHistory = async function () {
  const res = await fetch(`${BASE}/api/prediction/history`);
  if (!res.ok) throw new Error("history fetch failed");
  return res.json();
};

window.runWhatIfSimulation = async function (payload) {
  const res = await fetch(`${BASE}/api/simulation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("simulation failed");
  return res.json();
};
