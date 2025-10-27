// frontend/src/components/RecordCard.jsx
import { useEffect, useState } from "react";
import { getCowboysRecord } from "../api";

export default function RecordCard({ year }) {
  const [record, setRecord] = useState({ wins: 0, losses: 0, ties: 0, played: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getCowboysRecord(year);
        if (mounted) setRecord(data);
      } catch (e) {
        setErr("Failed to load record");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    // Refresh every 60s to catch in-progress changes / immediate finals
    const id = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(id); };
  }, [year]);

  if (loading) return <div className="p-4 rounded-xl shadow">Loading record…</div>;
  if (err) return <div className="p-4 rounded-xl shadow text-red-600">{err}</div>;

  const { wins, losses, ties } = record;

  return (
    <div className="p-4 rounded-xl shadow bg-white">
      <h2 className="text-xl font-semibold mb-2">Dallas Cowboys Record {year}</h2>
      <p className="text-2xl font-bold">{wins}-{losses}-{ties}</p>
      <p className="text-sm text-gray-500 mt-1">Wins–Losses–Ties (auto-updating)</p>
    </div>
  );
}
