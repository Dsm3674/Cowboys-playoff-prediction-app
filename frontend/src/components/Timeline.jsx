import React from "react";
import { api } from "../api";

/* ── helpers ─────────────────────────────────────────────────── */

function toTitleCase(str) {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function badgeClass(event) {
  const raw = (
    event.type || event.eventType || event.category ||
    event.title || event.name || ""
  ).toLowerCase();
  if (raw.includes("win") || raw.includes("victory")) return "success";
  if (raw.includes("loss") || raw.includes("blowout") || raw.includes("defeat")) return "danger";
  if (raw.includes("injury") || raw.includes("suspend")) return "warning";
  return "neutral";
}

function getTitle(e)  { return e.title || e.name || e.label || e.event || "Event"; }
function getDate(e)   { return e.date || e.eventDate || e.occurredAt || e.timestamp || ""; }
function getBody(e)   { return e.description || e.summary || e.body || e.reason || "No additional detail."; }
function getImpact(e) {
  const v = Number(e.impact ?? e.impactScore ?? e.score ?? 0);
  return Number.isNaN(v) ? 0 : Math.max(-10, Math.min(10, v));
}

function fmtDate(value) {
  if (!value) return "Date N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtShort(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── synthetic fallback events ───────────────────────────────── */

function syntheticEvents(season) {
  const y = season;
  return [
    { date: `${y}-09-07`, title: "Season Opener Win", type: "win", impact: 6, description: "Strong performance in Week 1 sets a positive tone." },
    { date: `${y}-09-14`, title: "Road Win", type: "win", impact: 5, description: "Solid road victory demonstrates depth." },
    { date: `${y}-09-21`, title: "Home Loss", type: "loss", impact: -5, description: "Dropped a close one at home — defense struggled in Q4." },
    { date: `${y}-09-28`, title: "Key Injury", type: "injury", impact: -7, description: "Starter ruled out 2-4 weeks with soft-tissue issue." },
    { date: `${y}-10-05`, title: "Bounce-Back Win", type: "win", impact: 6, description: "Backup steps up; offense moves the ball efficiently." },
    { date: `${y}-10-19`, title: "Blowout Loss", type: "loss", impact: -8, description: "Turnover-heavy outing — gave up four fumbles." },
    { date: `${y}-10-26`, title: "Bye Week", type: "neutral", impact: 1, description: "Rest and recovery heading into a tough stretch." },
    { date: `${y}-11-02`, title: "Divisional Win", type: "win", impact: 8, description: "Big divisional win tightens the standings race." },
    { date: `${y}-11-09`, title: "Starter Returns", type: "return", impact: 7, description: "Key player activated from IR — playoff picture brightens." },
    { date: `${y}-11-16`, title: "Overtime Win", type: "win", impact: 7, description: "Clutch field goal in overtime extends winning streak." },
    { date: `${y}-11-23`, title: "Trade Deadline Move", type: "signing", impact: 5, description: "Depth piece acquired ahead of a tough schedule run." },
    { date: `${y}-11-30`, title: "Loss vs. Top Seed", type: "loss", impact: -4, description: "Dropped against a playoff rival — seed implications." },
    { date: `${y}-12-07`, title: "Win Streak Continues", type: "win", impact: 6, description: "Third straight win — momentum building toward January." },
    { date: `${y}-12-21`, title: "Clutch Division Clinch", type: "win", impact: 9, description: "Division title clinched with a dominant performance." },
    { date: `${y}-01-04`, title: "Wild Card Win", type: "win", impact: 8, description: "Playoff win in the Wild Card round — next stop: Divisional." },
  ];
}

/* ── chart layout constants ──────────────────────────────────── */

const SVG_W    = 900;
const SVG_H    = 220;
const AXIS_Y   = 140;
const PAD_L    = 24;
const PAD_R    = 24;
const BAR_W    = 22;
const MAX_UP   = 110;  // px above axis for impact = +10
const MAX_DOWN = 60;   // px below axis for impact = -10

function impactToHeight(impact, positive) {
  const abs = Math.abs(impact);
  return positive
    ? (abs / 10) * MAX_UP
    : (abs / 10) * MAX_DOWN;
}

const COLOR = {
  success: "#4ade80",
  danger:  "#f87171",
  warning: "#fbbf24",
  neutral: "#60a5fa",
};

/* ── main component ──────────────────────────────────────────── */

function Timeline() {
  const [season, setSeason]         = React.useState(2025);
  const [events, setEvents]         = React.useState([]);
  const [selected, setSelected]     = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState("");
  const [usedSynthetic, setUsedSynthetic] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setUsedSynthetic(false);

    async function load() {
      try {
        if (!api?.getTimelineFull && !api?.getTimelinePoints) {
          throw new Error("API unavailable");
        }
        const json = api.getTimelineFull
          ? await api.getTimelineFull(season)
          : await api.getTimelinePoints(season);

        if (cancelled) return;

        const raw = Array.isArray(json.events)
          ? json.events
          : Array.isArray(json.timeline)
          ? json.timeline
          : [];

        if (!raw.length) throw new Error("no events");

        setEvents(raw);
        setSelected(raw[0] || null);
      } catch {
        if (!cancelled) {
          const syn = syntheticEvents(season);
          setEvents(syn);
          setSelected(syn[0]);
          setUsedSynthetic(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [season]);

  /* ── derive chart positions ──────────────────────────────────── */

  const chartEvents = React.useMemo(() => {
    if (!events.length) return [];

    const dated = events
      .map((e) => ({ ...e, _ts: new Date(getDate(e)).getTime() }))
      .filter((e) => !Number.isNaN(e._ts));

    if (!dated.length) return [];

    const minTs = Math.min(...dated.map((e) => e._ts));
    const maxTs = Math.max(...dated.map((e) => e._ts));
    const range = maxTs - minTs || 1;
    const drawW  = SVG_W - PAD_L - PAD_R;

    return dated.map((e) => {
      const pct = (e._ts - minTs) / range;
      const x = PAD_L + pct * drawW;
      return { ...e, x };
    });
  }, [events]);

  /* Month tick marks along axis */
  const monthTicks = React.useMemo(() => {
    if (!chartEvents.length) return [];
    const dated = chartEvents.filter((e) => e._ts);
    if (!dated.length) return [];

    const minTs = Math.min(...dated.map((e) => e._ts));
    const maxTs = Math.max(...dated.map((e) => e._ts));
    const range = maxTs - minTs || 1;
    const drawW = SVG_W - PAD_L - PAD_R;

    const ticks = [];
    let d = new Date(minTs);
    d.setDate(1);
    while (d.getTime() <= maxTs) {
      const pct = (d.getTime() - minTs) / range;
      const x = PAD_L + pct * drawW;
      ticks.push({
        x,
        label: d.toLocaleDateString(undefined, { month: "short" }),
      });
      d.setMonth(d.getMonth() + 1);
    }
    return ticks;
  }, [chartEvents]);

  /* ── render ──────────────────────────────────────────────────── */

  return (
    <div className="tl-root">
      <style>{`
        .tl-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: var(--fg, #e2e8f0);
        }
        .tl-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }
        .tl-controls label {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--fg-faint, #4a6080);
        }
        .tl-select {
          background: var(--card-bg, rgba(10,22,40,.95));
          border: 1px solid var(--border-soft, rgba(255,255,255,.08));
          color: var(--fg, #e2e8f0);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .tl-banner {
          font-size: 0.75rem;
          color: #fbbf24;
          background: rgba(251,191,36,.08);
          border: 1px solid rgba(251,191,36,.2);
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 1rem;
        }
        .tl-chart-wrap {
          background: var(--card-bg, rgba(10,22,40,.95));
          border: 1px solid var(--border-soft, rgba(255,255,255,.08));
          border-radius: 14px;
          padding: 1rem 0.5rem 0.5rem;
          overflow-x: auto;
          margin-bottom: 1.25rem;
        }
        .tl-chart-wrap svg {
          display: block;
          min-width: ${SVG_W}px;
        }
        .tl-bar {
          cursor: pointer;
          transition: opacity .15s;
        }
        .tl-bar:hover { opacity: .8; }
        .tl-bar-selected rect { filter: brightness(1.3); }
        .tl-axis-line {
          stroke: rgba(255,255,255,.12);
          stroke-width: 1.5;
        }
        .tl-tick-line {
          stroke: rgba(255,255,255,.06);
          stroke-width: 1;
        }
        .tl-tick-label {
          fill: rgba(255,255,255,.3);
          font-size: 10px;
          font-family: var(--font-mono, monospace);
          letter-spacing: .06em;
        }
        .tl-dot {
          transition: r .15s, filter .15s;
        }
        .tl-dot-selected {
          filter: drop-shadow(0 0 6px currentColor);
        }
        .tl-detail {
          background: var(--card-bg, rgba(10,22,40,.95));
          border: 1px solid var(--border-soft, rgba(255,255,255,.08));
          border-radius: 12px;
          padding: 1.25rem;
          animation: tl-fade-in .2s ease both;
        }
        @keyframes tl-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tl-detail-header {
          display: flex;
          align-items: center;
          gap: .75rem;
          flex-wrap: wrap;
          margin-bottom: .75rem;
        }
        .tl-badge {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .tl-badge--success { background: rgba(74,222,128,.15); color: #4ade80; }
        .tl-badge--danger  { background: rgba(248,113,113,.15); color: #f87171; }
        .tl-badge--warning { background: rgba(251,191,36,.15);  color: #fbbf24; }
        .tl-badge--neutral { background: rgba(96,165,250,.15);  color: #60a5fa; }
        .tl-detail-date {
          font-size: 0.78rem;
          color: var(--fg-faint, #4a6080);
          font-family: var(--font-mono, monospace);
        }
        .tl-impact-badge {
          margin-left: auto;
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 6px;
        }
        .tl-impact-pos { background: rgba(74,222,128,.12); color: #4ade80; }
        .tl-impact-neg { background: rgba(248,113,113,.12); color: #f87171; }
        .tl-detail-body {
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--fg-soft, #8aa0bc);
        }
        .tl-feed {
          margin-top: 1.25rem;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 6px;
        }
        .tl-feed-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid var(--border-soft, rgba(255,255,255,.06));
          cursor: pointer;
          text-align: left;
          transition: background .15s, border-color .15s;
          font-family: inherit;
          color: inherit;
        }
        .tl-feed-item:hover { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.12); }
        .tl-feed-item--active { background: rgba(96,165,250,.08); border-color: rgba(96,165,250,.25); }
        .tl-feed-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tl-feed-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--fg, #e2e8f0);
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tl-feed-date {
          font-size: 0.65rem;
          color: var(--fg-faint, #4a6080);
          font-family: var(--font-mono, monospace);
          flex-shrink: 0;
        }
        .tl-loading {
          padding: 2rem;
          text-align: center;
          color: var(--fg-faint, #4a6080);
          font-size: 0.85rem;
        }
      `}</style>

      {/* Controls */}
      <div className="tl-controls">
        <label>Season</label>
        <select
          className="tl-select"
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
        >
          {[2026, 2025, 2024, 2023].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {usedSynthetic && (
          <span className="tl-banner">
            Showing projected data — live season events load when available.
          </span>
        )}
      </div>

      {loading ? (
        <div className="tl-loading">Loading timeline…</div>
      ) : (
        <>
          {/* Chart */}
          <div className="tl-chart-wrap">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
              {/* Axis line */}
              <line
                className="tl-axis-line"
                x1={PAD_L} y1={AXIS_Y}
                x2={SVG_W - PAD_R} y2={AXIS_Y}
              />

              {/* Month ticks */}
              {monthTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    className="tl-tick-line"
                    x1={tick.x} y1={AXIS_Y - 8}
                    x2={tick.x} y2={AXIS_Y + MAX_DOWN + 8}
                  />
                  <text
                    className="tl-tick-label"
                    x={tick.x}
                    y={AXIS_Y + MAX_DOWN + 20}
                    textAnchor="middle"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Zero line labels */}
              <text className="tl-tick-label" x={10} y={AXIS_Y + 4} textAnchor="middle">0</text>
              <text className="tl-tick-label" x={10} y={AXIS_Y - MAX_UP + 4} textAnchor="middle">+</text>
              <text className="tl-tick-label" x={10} y={AXIS_Y + MAX_DOWN - 4} textAnchor="middle">−</text>

              {/* Event bars */}
              {chartEvents.map((ev, i) => {
                const impact = getImpact(ev);
                const cls    = badgeClass(ev);
                const color  = COLOR[cls];
                const isPos  = impact >= 0;
                const h      = impactToHeight(impact, isPos);
                const barX   = ev.x - BAR_W / 2;
                const barY   = isPos ? AXIS_Y - h : AXIS_Y;
                const isSelected = selected === events[i];

                return (
                  <g
                    key={i}
                    className={`tl-bar${isSelected ? " tl-bar-selected" : ""}`}
                    onClick={() => setSelected(events[i])}
                  >
                    <rect
                      x={barX}
                      y={barY}
                      width={BAR_W}
                      height={Math.max(h, 2)}
                      rx={4}
                      fill={color}
                      opacity={isSelected ? 0.9 : 0.45}
                    />
                    <circle
                      className={`tl-dot${isSelected ? " tl-dot-selected" : ""}`}
                      cx={ev.x}
                      cy={isPos ? AXIS_Y - h - 5 : AXIS_Y + h + 5}
                      r={isSelected ? 5 : 4}
                      fill={color}
                      stroke={isSelected ? "#fff" : "transparent"}
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected event detail */}
          {selected && (
            <div className="tl-detail">
              <div className="tl-detail-header">
                <span className={`tl-badge tl-badge--${badgeClass(selected)}`}>
                  {toTitleCase(getTitle(selected))}
                </span>
                <span className="tl-detail-date">{fmtDate(getDate(selected))}</span>
                {getImpact(selected) !== 0 && (
                  <span className={`tl-impact-badge ${getImpact(selected) >= 0 ? "tl-impact-pos" : "tl-impact-neg"}`}>
                    {getImpact(selected) >= 0 ? "+" : ""}{getImpact(selected)} pts
                  </span>
                )}
              </div>
              <p className="tl-detail-body">{getBody(selected)}</p>
            </div>
          )}

          {/* Event list grid */}
          <div className="tl-feed">
            {events.map((ev, i) => {
              const cls = badgeClass(ev);
              return (
                <button
                  key={i}
                  type="button"
                  className={`tl-feed-item${selected === ev ? " tl-feed-item--active" : ""}`}
                  onClick={() => setSelected(ev)}
                >
                  <span className="tl-feed-dot" style={{ background: COLOR[cls] }} />
                  <span className="tl-feed-title">{getTitle(ev)}</span>
                  <span className="tl-feed-date">{fmtShort(getDate(ev))}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

window.Timeline = Timeline;
export default Timeline;
