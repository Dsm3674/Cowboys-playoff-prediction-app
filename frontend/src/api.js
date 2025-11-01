const BASE = "http://localhost:3001";

async function getCowboysRecord(year) {
  const res = await fetch(`${BASE}/api/cowboys/record?year=${year}`);
  if (!res.ok) throw new Error("record fetch failed");
  return res.json();
}

async function getCowboysSchedule(year) {
  const res = await fetch(`${BASE}/api/cowboys/schedule?year=${year}`);
  if (!res.ok) throw new Error("schedule fetch failed");
  return res.json();
}
