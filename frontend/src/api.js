
const BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

export async function getCowboysRecord(year) {
  const res = await fetch(`${BASE}/api/cowboys/record?year=${year}`);
  if (!res.ok) throw new Error("record fetch failed");
  return res.json();
}

export async function getCowboysSchedule(year) {
  const res = await fetch(`${BASE}/api/cowboys/schedule?year=${year}`);
  if (!res.ok) throw new Error("schedule fetch failed");
  return res.json();
}
