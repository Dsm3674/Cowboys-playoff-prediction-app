import React from "react";
import { api } from "../api";

/* ── helpers ─────────────────────────────────────────────────── */

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
    { date: `${y}-09-07`, title: "Season Opener Win",       type: "win",     impact: 6,  description: "Strong performance in Week 1 sets a positive tone." },
    { date: `${y}-09-14`, title: "Road Win",                type: "win",     impact: 5,  description: "Solid road victory demonstrates depth." },
    { date: `${y}-09-21`, title: "Home Loss",               type: "loss",    impact: -5, description: "Dropped a close one at home — defense struggled in Q4." },
    { date: `${y}-09-28`, title: "Key Injury",              type: "injury",  impact: -7, description: "Starter ruled out 2–4 weeks with soft-tissue issue." },
    { date: `${y}-10-05`, title: "Bounce-Back Win",         type: "win",     impact: 6,  description: "Backup steps up; offense moves the ball efficiently." },
    { date: `${y}-10-19`, title: "Blowout Loss",            type: "loss",    impact: -8, description: "Turnover-heavy outing — gave up four fumbles." },
    { date: `${y}-10-26`, title: "Bye Week",                type: "neutral", impact: 1,  description: "Rest and recovery heading into a tough stretch." },
    { date: `${y}-11-02`, title: "Divisional Win",          type: "win",     impact: 8,  description: "Big divisional win tightens the standings race." },
    { date: `${y}-11-09`, title: "Starter Returns",         type: "return",  impact: 7,  description: "Key player activated from IR — playoff picture brightens." },
    { date: `${y}-11-16`, title: "Overtime Win",            type: "win",     impact: 7,  description: "Clutch field goal in overtime extends winning streak." },
    { date: `${y}-11-23`, title: "Trade Deadline Move",     type: "signing", impact: 5,  description: "Depth piece acquired ahead of a tough schedule run." },
    { date: `${y}-11-30`, title: "Loss vs. Top Seed",       type: "loss",    impact: -4, description: "Dropped against a playoff rival — seed implications." },
    { date: `${y}-12-07`, title: "Win Streak Continues",    type: "win",     impact: 6,  description: "Third straight win — momentum building toward January." },
    { date: `${y}-12-21`, title: "Clutch Division Clinch",  type: "win",     impact: 9,  description: "Division title clinched with a dominant performance." },
    { date: `${y}-01-04`, title: "Wild Card Win",           type: "win",     impact: 8,  description: "Playoff win in the Wild Card round — next stop: Divisional." },
  ];
}

/* ── SVG layout ──────────────────────────────────────────────── */

const W        = 880;
const H        = 240;
const PAD_L    = 44;
const PAD_R    = 20;
const PAD_T    = 18;
const PAD_B    = 36;

const CHART_W  = W - PAD_L - PAD_R;
const CHART_H  = H - PAD_T - PAD_B;

const COLORS = {
  success: "#4ade80",
  danger:  "#f87171",
  warning: "#fbbf24",
  neutral: "#60a5fa",
};

/* build a smooth cubic bezier path through an array of {x,y} points */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const cpx = ((p.x + c.x) / 2).toFixed(1);
    d += ` C ${cpx} ${p.y.toFixed(1)}, ${cpx} ${c.y.toFixed(1)}, ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
  }
  return d;
}

/* closed area path (line + bottom close) */
function areaPath(pts, zeroY) {
  if (pts.length < 2) return "";
  const line = smoothPath(pts);
  return `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
}

/* ── main component ──────────────────────────────────────────── */

export default function Timeline() {
  const [season, setSeason]     = React.useState(2024);
  const [events, setEvents]     = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [loading, setLoading]   = React.useState(true);
  const [synthetic, setSynthetic] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSynthetic(false);

    async function load() {
      try {
        if (!api?.getTimelineFull && !api?.getTimelinePoints) throw new Error("API unavailable");
        const json = api.getTimelineFull
          ? await api.getTimelineFull(season)
          : await api.getTimelinePoints(season);
        if (cancelled) return;
        const raw = Array.isArray(json.events)
          ? json.events : Array.isArray(json.timeline) ? json.timeline : [];
        if (!raw.length) throw new Error("no events");
        setEvents(raw);
        setSelected(raw[0]);
      } catch {
        if (!cancelled) {
          const syn = syntheticEvents(season);
          setEvents(syn);
          setSelected(syn[0]);
          setSynthetic(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [season]);

  /* ── derive chart data ───────────────────────────────────── */

  const { plotPoints, zeroY, monthTicks, yLabels } = React.useMemo(() => {
    if (!events.length) return { plotPoints: [], zeroY: 0, monthTicks: [], yLabels: [] };

    const dated = events
      .map((e) => ({ ...e, _ts: new Date(getDate(e)).getTime() }))
      .filter((e) => !Number.isNaN(e._ts))
      .sort((a, b) => a._ts - b._ts);

    if (!dated.length) return { plotPoints: [], zeroY: 0, monthTicks: [], yLabels: [] };

    const minTs = Math.min(...dated.map((e) => e._ts));
    const maxTs = Math.max(...dated.map((e) => e._ts));
    const tsRange = maxTs - minTs || 1;

    /* cumulative impact */
    let running = 0;
    const withCumul = dated.map((e) => {
      running += getImpact(e);
      return { ...e, cumul: running };
    });

    const allCumuls = [0, ...withCumul.map((e) => e.cumul)];
    const minCumul  = Math.min(...allCumuls);
    const maxCumul  = Math.max(...allCumuls);
    const cRange    = maxCumul - minCumul || 1;

    /* y-scale: map cumulative value to SVG y */
    function toY(val) {
      return PAD_T + CHART_H - ((val - minCumul) / cRange) * CHART_H;
    }

    const zeroYCoord = toY(0);

    const plotPoints = withCumul.map((e) => ({
      ...e,
      x: PAD_L + ((e._ts - minTs) / tsRange) * CHART_W,
      y: toY(e.cumul),
    }));

    /* month tick lines */
    const monthTicks = [];
    const d0 = new Date(minTs);
    d0.setDate(1);
    while (d0.getTime() <= maxTs) {
      const x = PAD_L + ((d0.getTime() - minTs) / tsRange) * CHART_W;
      monthTicks.push({
        x,
        label: d0.toLocaleDateString(undefined, { month: "short" }),
      });
      d0.setMonth(d0.getMonth() + 1);
    }

    /* y-axis labels */
    const step = Math.ceil(cRange / 4);
    const yLabels = [];
    for (let v = Math.ceil(minCumul / step) * step; v <= maxCumul; v += step) {
      yLabels.push({ y: toY(v), label: v > 0 ? `+${v}` : String(v) });
    }

    return { plotPoints, zeroY: zeroYCoord, monthTicks, yLabels };
  }, [events]);

  /* split into above-zero and below-zero segments for dual-color fill */
  const abovePts = plotPoints.map((p) => ({ ...p, y: Math.min(p.y, zeroY) }));
  const belowPts = plotPoints.map((p) => ({ ...p, y: Math.max(p.y, zeroY) }));

  const linePath   = smoothPath(plotPoints);
  const aboveArea  = areaPath(abovePts, zeroY);
  const belowArea  = areaPath(belowPts, zeroY);

  const selectedIdx = selected ? plotPoints.findIndex((p) => p === selected || (p.title === selected.title && p._ts === new Date(getDate(selected)).getTime())) : -1;

  return (
    <div className="tl-root">
      <style>{`
        .tl-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: #e2e8f0;
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
          color: #4a6080;
        }
        .tl-select {
          background: rgba(10,22,40,.95);
          border: 1px solid rgba(255,255,255,.08);
          color: #e2e8f0;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .tl-synthetic-note {
          font-size: 0.72rem;
          color: #fbbf24;
          background: rgba(251,191,36,.07);
          border: 1px solid rgba(251,191,36,.18);
          border-radius: 6px;
          padding: 5px 10px;
        }
        .tl-chart-wrap {
          background: rgba(8,18,36,.97);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px;
          padding: 8px 4px 4px;
          overflow-x: auto;
          margin-bottom: 1.25rem;
          position: relative;
        }
        .tl-chart-wrap svg {
          display: block;
          min-width: ${W}px;
          overflow: visible;
        }
        .tl-axis {
          stroke: rgba(255,255,255,.1);
          stroke-width: 1;
        }
        .tl-zero-line {
          stroke: rgba(255,255,255,.14);
          stroke-width: 1;
          stroke-dasharray: 4 4;
        }
        .tl-grid-line {
          stroke: rgba(255,255,255,.04);
          stroke-width: 1;
        }
        .tl-tick-label {
          fill: rgba(255,255,255,.28);
          font-size: 9.5px;
          font-family: var(--font-mono, monospace);
          letter-spacing: .05em;
        }
        .tl-line {
          fill: none;
          stroke: #60a5fa;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(96,165,250,0.35));
        }
        .tl-area-above {
          fill: url(#tl-grad-above);
        }
        .tl-area-below {
          fill: url(#tl-grad-below);
        }
        .tl-dot {
          cursor: pointer;
          transition: r .12s;
        }
        .tl-dot:hover { r: 6; }
        .tl-dot-ring {
          pointer-events: none;
          fill: none;
          stroke-width: 2;
        }
        .tl-loading {
          padding: 3rem;
          text-align: center;
          color: #4a6080;
          font-size: 0.85rem;
        }
        .tl-detail {
          background: rgba(10,22,40,.95);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          animation: tl-in .2s ease both;
        }
        @keyframes tl-in {
          from { opacity:0; transform:translateY(5px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .tl-detail-header {
          display: flex;
          align-items: center;
          gap: .75rem;
          flex-wrap: wrap;
          margin-bottom: .65rem;
        }
        .tl-badge {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: .13em;
          text-transform: uppercase;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .tl-badge--success { background: rgba(74,222,128,.14); color: #4ade80; }
        .tl-badge--danger  { background: rgba(248,113,113,.14); color: #f87171; }
        .tl-badge--warning { background: rgba(251,191,36,.14);  color: #fbbf24; }
        .tl-badge--neutral { background: rgba(96,165,250,.14);  color: #60a5fa; }
        .tl-detail-date {
          font-size: 0.75rem;
          color: #4a6080;
          font-family: var(--font-mono, monospace);
        }
        .tl-impact-chip {
          margin-left: auto;
          font-family: var(--font-mono, monospace);
          font-size: 0.78rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 6px;
        }
        .tl-impact-pos { background: rgba(74,222,128,.1); color: #4ade80; }
        .tl-impact-neg { background: rgba(248,113,113,.1); color: #f87171; }
        .tl-detail-body {
          font-size: 0.875rem;
          line-height: 1.65;
          color: #7a94b0;
        }
      `}</style>

      <div className="tl-controls">
        <label>Season</label>
        <select className="tl-select" value={season} onChange={(e) => setSeason(Number(e.target.value))}>
          {[2026, 2025, 2024, 2023].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {synthetic && (
          <span className="tl-synthetic-note">Showing projected data — live events load when available.</span>
        )}
      </div>

      {loading ? (
        <div className="tl-loading">Loading momentum data…</div>
      ) : (
        <>
          <div className="tl-chart-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="tl-grad-above" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#60a5fa" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.03" />
                </linearGradient>
                <linearGradient id="tl-grad-below" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#f87171" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#f87171" stopOpacity="0.2" />
                </linearGradient>
                <filter id="tl-dot-glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Y-axis grid lines */}
              {yLabels.map((lbl, i) => (
                <g key={i}>
                  <line className="tl-grid-line" x1={PAD_L} y1={lbl.y} x2={W - PAD_R} y2={lbl.y} />
                  <text className="tl-tick-label" x={PAD_L - 6} y={lbl.y + 3.5} textAnchor="end">{lbl.label}</text>
                </g>
              ))}

              {/* Zero baseline */}
              <line className="tl-zero-line" x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} />
              <text className="tl-tick-label" x={PAD_L - 6} y={zeroY + 3.5} textAnchor="end" style={{ fill: 'rgba(255,255,255,.4)' }}>0</text>

              {/* X-axis month ticks */}
              {monthTicks.map((tick, i) => (
                <g key={i}>
                  <line x1={tick.x} y1={PAD_T} x2={tick.x} y2={H - PAD_B + 4}
                    stroke="rgba(255,255,255,.06)" strokeWidth="1" />
                  <text className="tl-tick-label" x={tick.x} y={H - PAD_B + 16} textAnchor="middle">{tick.label}</text>
                </g>
              ))}

              {/* Area fills */}
              {plotPoints.length > 1 && (
                <>
                  <path className="tl-area-above" d={aboveArea} />
                  <path className="tl-area-below" d={belowArea} />
                </>
              )}

              {/* Main line */}
              {plotPoints.length > 1 && (
                <path className="tl-line" d={linePath} />
              )}

              {/* Event dots */}
              {plotPoints.map((pt, i) => {
                const cls    = badgeClass(pt);
                const color  = COLORS[cls];
                const isSel  = selectedIdx === i;
                const impact = getImpact(pt);

                return (
                  <g key={i} onClick={() => setSelected(events[events.indexOf(pt)] ?? events[i])}
                    style={{ cursor: 'pointer' }}>
                    {isSel && (
                      <circle
                        className="tl-dot-ring"
                        cx={pt.x} cy={pt.y}
                        r={11}
                        stroke={color}
                        strokeOpacity={0.35}
                        filter="url(#tl-dot-glow)"
                      />
                    )}
                    <circle
                      className="tl-dot"
                      cx={pt.x} cy={pt.y}
                      r={isSel ? 7 : 5}
                      fill={isSel ? color : "rgba(10,22,40,.9)"}
                      stroke={color}
                      strokeWidth={isSel ? 0 : 2}
                      filter={isSel ? "url(#tl-dot-glow)" : undefined}
                    />
                    {isSel && (
                      <line
                        x1={pt.x} y1={pt.y + 9}
                        x2={pt.x} y2={zeroY}
                        stroke={color}
                        strokeWidth={1}
                        strokeOpacity={0.3}
                        strokeDasharray="3 3"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detail card */}
          {selected && (() => {
            const cls    = badgeClass(selected);
            const impact = getImpact(selected);
            return (
              <div className="tl-detail" key={getDate(selected) + getTitle(selected)}>
                <div className="tl-detail-header">
                  <span className={`tl-badge tl-badge--${cls}`}>{getTitle(selected)}</span>
                  <span className="tl-detail-date">{fmtDate(getDate(selected))}</span>
                  {impact !== 0 && (
                    <span className={`tl-impact-chip ${impact >= 0 ? "tl-impact-pos" : "tl-impact-neg"}`}>
                      {impact >= 0 ? "+" : ""}{impact} pts
                    </span>
                  )}
                </div>
                <p className="tl-detail-body">{getBody(selected)}</p>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

window.Timeline = Timeline;
