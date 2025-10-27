// frontend/src/components/GameTable.jsx
import { useEffect, useState } from "react";
import { getCowboysSchedule } from "../api";

function badge(color, text) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{text}</span>;
}

export default function GameTable({ year }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCowboysSchedule(year);
        if (mounted) setGames(data.games);
      } catch (e) {
        setErr("Failed to load schedule");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60000); // refresh every minute
    return () => { mounted = false; clearInterval(id); };
  }, [year]);

  if (loading) return <div className="p-4 rounded-xl shadow">Loading schedule…</div>;
  if (err) return <div className="p-4 rounded-xl shadow text-red-600">{err}</div>;

  return (
    <div className="mt-4 p-4 rounded-xl shadow bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left">
          <tr className="border-b">
            <th className="py-2 pr-4">Week</th>
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Vs.</th>
            <th className="py-2 pr-4">H/A</th>
            <th className="py-2 pr-4">Score</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Result</th>
          </tr>
        </thead>
        <tbody>
          {games.map(g => {
            const d = new Date(g.date);
            const dateStr = d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
            const statusChip = g.status === "final"
              ? badge("bg-gray-100", "Final")
              : g.status === "in_progress"
              ? badge("bg-yellow-100", "Live")
              : badge("bg-blue-100", "Scheduled");

            return (
              <tr key={g.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{g.week ?? "-"}</td>
                <td className="py-2 pr-4">{dateStr}</td>
                <td className="py-2 pr-4">{g.opponent}</td>
                <td className="py-2 pr-4 uppercase">{g.homeAway?.[0]}</td>
                <td className="py-2 pr-4">
                  {g.status === "scheduled" ? "-" : `${g.teamScore}–${g.oppScore}`}
                </td>
                <td className="py-2 pr-4">{statusChip}</td>
                <td className="py-2 pr-4 font-semibold">{g.result ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">Auto-refreshes every minute. Includes ties.</p>
    </div>
  );
}
