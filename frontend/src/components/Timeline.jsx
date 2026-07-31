import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";

/* ── Helpers ─────────────────────────────────────────────────── */

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

/* ── Synthetic Fallback Events (2027 SEASON) ────────────────────── */

function syntheticEvents(season) {
  const y = season;
  return [
    { date: `${y}-09-07`, title: "Season Opener Win",       type: "win",     impact: 6,  description: "Strong performance in Week 1 sets a positive tone." },
    { date: `${y}-09-14`, title: "Road Win",                type: "win",     impact: 5,  description: "Solid road victory demonstrates depth." },
    { date: `${y}-09-21`, title: "Home Loss",               type: "loss",    impact: -5, description: "Dropped a close one at home — defense struggled in Q4." },
    { date: `${y}-09-28`, title: "Key Injury",              type: "injury",  impact: -7, description: "Starter ruled out 2–4 weeks with soft-tissue issue." },
    { date: `${y}-10-05`, title: "Bounce-Back Win",         type: "win",     impact: 6,  description: "Backup steps up; offense moves efficiently." },
    { date: `${y}-10-19`, title: "Blowout Loss",            type: "loss",    impact: -8, description: "Turnover-heavy outing — gave up four fumbles." },
    { date: `${y}-10-26`, title: "Bye Week",                type: "neutral", impact: 1,  description: "Rest and recovery heading into a tough stretch." },
    { date: `${y}-11-02`, title: "Divisional Win",          type: "win",     impact: 8,  description: "Big divisional win tightens the standings race." },
    { date: `${y}-11-09`, title: "Starter Returns",         type: "return",  impact: 7,  description: "Key player activated from IR — playoff picture brightens." },
    { date: `${y}-11-16`, title: "Overtime Win",            type: "win",     impact: 7,  description: "Clutch field goal in overtime extends winning streak." },
    { date: `${y}-11-23`, title: "Trade Deadline Move",     type: "signing", impact: 5,  description: "Depth piece acquired ahead of a tough schedule run." },
    { date: `${y}-11-30`, title: "Loss vs. Top Seed",       type: "loss",    impact: -4, description: "Dropped against a playoff rival — seed implications." },
    { date: `${y}-12-07`, title: "Win Streak Continues",    type: "win",     impact: 6,  description: "Third straight win — momentum building toward January." },
    { date: `${y}-12-21`, title: "Clutch Division Clinch",  type: "win",     impact: 9,  description: "Division title clinched with a dominant performance." },
    /* January playoff games belong to the *following* calendar year — dating
       them `${y}-01-04` sorted them ahead of Week 1 and stretched the x-axis
       across eight empty months. */
    { date: `${y + 1}-01-04`, title: "Wild Card Win",       type: "win",     impact: 8,  description: "Playoff win in the Wild Card round — next stop: Divisional." },
  ];
}

/* ── SVG Layout Constants ────────────────────────────────────── */

/* These are viewBox *user units*, not pixels and not percentages. The SVG is
   made responsive by the viewBox + `width: 100%` on the element (see CSS),
   so this coordinate space must stay wide enough to actually draw a chart in. */
const W        = 880;
const H        = 240;
const PAD_L    = 44;
const PAD_R    = 20;
const PAD_T    = 18;
const PAD_B    = 36;

const CHART_W  = W - PAD_L - PAD_R;
const CHART_H  = H - PAD_T - PAD_B;

const COLORS = {
  success: "#22c55e",   // green, more vibrant
  danger:  "#ef4444",   // red, more vibrant
  warning: "#f59e0b",   // amber
  neutral: "#3b82f6",   // blue
};

const DOT_R      = 5;
const DOT_R_HOVER = 6.5;
const DOT_R_SEL  = 7;

/* ── Path helpers ────────────────────────────────────────────── */

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

function areaPath(pts, zeroY) {
  if (pts.length < 2) return "";
  const line = smoothPath(pts);
  return `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;
}

/* ── Main Component ──────────────────────────────────────────── */

export default function Timeline() {
  const [season, setSeason]     = useState(2027);
  const [events, setEvents]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [synthetic, setSynthetic] = useState(false);
  const [hovered, setHovered]   = useState(null);   // { pt, x, y, flip } in wrapper px
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
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

  /* Clear any hover state when the data set changes out from under it. */
  useEffect(() => { setHovered(null); }, [events]);

  /* ── Derive chart data ───────────────────────────────────────── */

  const { plotPoints, zeroY, monthTicks, yLabels } = useMemo(() => {
    const empty = { plotPoints: [], zeroY: 0, monthTicks: [], yLabels: [] };
    if (!events.length) return empty;

    /* `_src` keeps a reference back to the original event object: plot points
       are filtered and re-sorted, so their index is NOT the index in `events`. */
    const dated = events
      .map((e) => ({ ...e, _src: e, _ts: new Date(getDate(e)).getTime() }))
      .filter((e) => !Number.isNaN(e._ts))
      .sort((a, b) => a._ts - b._ts);

    if (!dated.length) return empty;

    const minTs = dated[0]._ts;
    const maxTs = dated[dated.length - 1]._ts;
    const tsRange = maxTs - minTs || 1;

    let running = 0;
    const withCumul = dated.map((e) => {
      running += getImpact(e);
      return { ...e, cumul: running };
    });

    const allCumuls = [0, ...withCumul.map((e) => e.cumul)];
    const minCumul  = Math.min(...allCumuls);
    const maxCumul  = Math.max(...allCumuls);
    const cRange    = maxCumul - minCumul || 1;

    function toX(ts)  { return PAD_L + ((ts - minTs) / tsRange) * CHART_W; }
    function toY(val) { return PAD_T + CHART_H - ((val - minCumul) / cRange) * CHART_H; }

    const zeroYCoord = toY(0);

    const plotPoints = withCumul.map((e) => ({
      ...e,
      x: toX(e._ts),
      y: toY(e.cumul),
    }));

    /* Month tick lines — skip the partial month before the first event so
       labels never land on top of the y-axis. */
    const monthTicks = [];
    const d0 = new Date(minTs);
    d0.setDate(1);
    if (d0.getTime() < minTs) d0.setMonth(d0.getMonth() + 1);
    while (d0.getTime() <= maxTs) {
      monthTicks.push({
        x: toX(d0.getTime()),
        label: d0.toLocaleDateString(undefined, { month: "short" }),
      });
      d0.setMonth(d0.getMonth() + 1);
    }

    /* Y-axis labels — zero gets its own styled label on the baseline. */
    const step = Math.max(1, Math.ceil(cRange / 4));
    const yLabels = [];
    for (let v = Math.ceil(minCumul / step) * step; v <= maxCumul; v += step) {
      if (v === 0) continue;
      yLabels.push({ y: toY(v), label: v > 0 ? `+${v}` : String(v) });
    }

    return { plotPoints, zeroY: zeroYCoord, monthTicks, yLabels };
  }, [events]);

  const abovePts = plotPoints.map((p) => ({ ...p, y: Math.min(p.y, zeroY) }));
  const belowPts = plotPoints.map((p) => ({ ...p, y: Math.max(p.y, zeroY) }));

  const linePath   = smoothPath(plotPoints);
  const aboveArea  = areaPath(abovePts, zeroY);
  const belowArea  = areaPath(belowPts, zeroY);

  const selectedIdx = selected ? plotPoints.findIndex((p) => p._src === selected) : -1;

  /* ── Tooltip positioning ─────────────────────────────────────── */

  /* Map a point from viewBox user units to pixels inside .tl-chart-wrap.
     getScreenCTM accounts for the viewBox scale, so this stays correct at
     any container width. */
  const showTooltip = useCallback((pt) => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || typeof svg.getScreenCTM !== "function") {
      setHovered({ pt, x: 0, y: 0, flip: false });
      return;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const sp = svg.createSVGPoint();
    sp.x = pt.x;
    sp.y = pt.y;
    const screen = sp.matrixTransform(ctm);
    const wrapRect = wrap.getBoundingClientRect();
    const x = screen.x - wrapRect.left + wrap.scrollLeft;
    const y = screen.y - wrapRect.top + wrap.scrollTop;
    /* Flip based on where the dot sits in the *visible* area, not the full
       scroll width, so the tooltip stays inside the frame when scrolled. */
    setHovered({ pt, x, y, flip: x - wrap.scrollLeft > wrap.clientWidth * 0.6 });
  }, []);

  /* ── Keyboard navigation (scoped to the focused chart) ───────── */

  const handleChartKey = (e) => {
    if (!plotPoints.length) return;
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") delta = 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") delta = -1;
    else return;

    const next = selectedIdx === -1
      ? (delta > 0 ? 0 : plotPoints.length - 1)
      : selectedIdx + delta;
    if (next < 0 || next >= plotPoints.length) return;

    e.preventDefault();
    setSelected(plotPoints[next]._src);
  };

  return (
    <div className="tl-root">
      <style>{`
        .tl-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: #e2e8f0;
        }

        .tl-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        /* SEASON PILLS (not dropdown) */
        .tl-season-selector {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .tl-season-pill {
          padding: 8px 16px;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }

        .tl-season-pill:hover {
          border-color: rgba(108,99,255,0.4);
          background: rgba(108,99,255,0.08);
          color: rgba(255,255,255,0.8);
        }

        .tl-season-pill.active {
          background: linear-gradient(135deg, #6c63ff, #a78bfa);
          color: #fff;
          border-color: #6c63ff;
        }

        .tl-synthetic-note {
          font-size: 11px;
          color: #fbbf24;
          background: rgba(251,191,36,.07);
          border: 1px solid rgba(251,191,36,.18);
          border-radius: 6px;
          padding: 5px 10px;
        }

        /* CHART CONTAINER */
        .tl-chart-wrap {
          background: rgba(8,18,36,.97);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px;
          padding: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .tl-chart-wrap:focus-visible {
          outline: 2px solid rgba(108,99,255,.7);
          outline-offset: 2px;
        }

        /* The viewBox does the scaling: width follows the container, height
           follows the aspect ratio. min-width keeps labels legible on phones
           (the wrapper scrolls horizontally instead of squashing the chart). */
        .tl-chart-wrap svg {
          display: block;
          width: 100%;
          height: auto;
          min-width: 640px;
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
          fill: rgba(255,255,255,.3);
          font-size: 10.5px;
          font-family: var(--font-mono, monospace);
          letter-spacing: .05em;
        }

        .tl-line {
          fill: none;
          stroke: #3b82f6;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 5px rgba(59,130,246,0.3));
        }

        .tl-area-above { fill: url(#tl-grad-above); }
        .tl-area-below { fill: url(#tl-grad-below); }

        .tl-dot {
          cursor: pointer;
          transition: r .15s ease;
        }

        .tl-dot-ring {
          pointer-events: none;
          fill: none;
          stroke-width: 2;
        }

        /* Widened invisible hit area so the dots stay easy to hit on touch. */
        .tl-dot-hit {
          fill: transparent;
          cursor: pointer;
        }

        .tl-tooltip {
          position: absolute;
          background: rgba(10,22,40,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          color: #e2e8f0;
          pointer-events: none;
          z-index: 10;
          white-space: nowrap;
          box-shadow: 0 6px 18px rgba(0,0,0,.35);
        }

        .tl-loading {
          padding: 3rem;
          text-align: center;
          color: #4a6080;
          font-size: 0.85rem;
        }

        /* DETAIL CARD */
        .tl-detail {
          background: rgba(10,22,40,.95);
          border: 1px solid rgba(255,255,255,.08);
          border-left: 4px solid var(--detail-color, #6c63ff);
          border-radius: 12px;
          padding: 1.5rem;
          animation: tl-in .2s ease both;
        }

        @keyframes tl-in {
          from { opacity:0; transform:translateY(4px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .tl-detail-header {
          margin-bottom: 1rem;
        }

        .tl-detail-title {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
        }

        .tl-detail-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .tl-detail-date {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          font-family: var(--font-mono, monospace);
        }

        .tl-impact-chip {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .tl-impact-pos {
          background: rgba(34,197,94,.12);
          color: #22c55e;
        }

        .tl-impact-neg {
          background: rgba(239,68,68,.12);
          color: #ef4444;
        }

        .tl-detail-body {
          font-size: 14px;
          line-height: 1.6;
          color: #a1aec5;
        }

        /* RESPONSIVE ─────────────────────────────────────────────── */

        @media (max-width: 1024px) {
          .tl-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .tl-season-selector {
            width: 100%;
            justify-content: space-between;
          }
        }

        @media (max-width: 768px) {
          .tl-header {
            flex-direction: column;
            gap: 12px;
          }

          .tl-season-selector {
            flex-wrap: wrap;
            gap: 8px;
          }

          .tl-season-pill {
            padding: 6px 12px;
            font-size: 12px;
          }

          .tl-chart-wrap {
            padding: 8px;
          }

          .tl-detail {
            padding: 1.25rem;
          }

          .tl-detail-title {
            font-size: 15px;
          }

          .tl-detail-body {
            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .tl-season-pill {
            padding: 5px 10px;
            font-size: 11px;
          }

          .tl-chart-wrap {
            border-radius: 12px;
          }

          .tl-detail {
            padding: 1rem;
            border-left-width: 3px;
          }

          .tl-detail-title {
            font-size: 14px;
          }

          .tl-detail-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
        }
      `}</style>

      {/* Header with season selector and note */}
      <div className="tl-header">
        <div className="tl-season-selector">
          {[2027, 2026, 2025, 2024].map((y) => (
            <button
              key={y}
              type="button"
              className={`tl-season-pill ${season === y ? "active" : ""}`}
              aria-pressed={season === y}
              onClick={() => setSeason(y)}
            >
              {y}
            </button>
          ))}
        </div>
        {synthetic && (
          <span className="tl-synthetic-note">📊 Projected data — live events load when available</span>
        )}
      </div>

      {/* Main content */}
      {loading ? (
        <div className="tl-loading">Loading momentum data…</div>
      ) : (
        <>
          {/* Chart */}
          <div
            className="tl-chart-wrap"
            ref={wrapRef}
            tabIndex={0}
            role="group"
            aria-label={`${season} season momentum timeline — use arrow keys to step through events`}
            onKeyDown={handleChartKey}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Cumulative momentum by event date"
            >
              <defs>
                <linearGradient id="tl-grad-above" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="tl-grad-below" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              {/* Y-axis grid lines */}
              {yLabels.map((lbl, i) => (
                <g key={`grid-${i}`}>
                  <line className="tl-grid-line" x1={PAD_L} y1={lbl.y} x2={W - PAD_R} y2={lbl.y} />
                  <text className="tl-tick-label" x={PAD_L - 8} y={lbl.y + 3.5} textAnchor="end">{lbl.label}</text>
                </g>
              ))}

              {/* Zero baseline */}
              <line className="tl-zero-line" x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} />
              <text className="tl-tick-label" x={PAD_L - 8} y={zeroY + 3.5} textAnchor="end" style={{ fill: 'rgba(255,255,255,.45)' }}>0</text>

              {/* X-axis month ticks */}
              {monthTicks.map((tick, i) => (
                <g key={`month-${i}`}>
                  <line x1={tick.x} y1={PAD_T} x2={tick.x} y2={H - PAD_B + 3}
                    stroke="rgba(255,255,255,.05)" strokeWidth="1" />
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

              {/* Event dots (color-coded by type) */}
              {plotPoints.map((pt, i) => {
                const cls    = badgeClass(pt);
                const color  = COLORS[cls];
                const isSel  = selectedIdx === i;
                const isHot  = hovered?.pt === pt;
                const r      = isSel ? DOT_R_SEL : isHot ? DOT_R_HOVER : DOT_R;

                return (
                  <g
                    key={`dot-${i}`}
                    onClick={() => setSelected(pt._src)}
                    onMouseEnter={() => showTooltip(pt)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isSel && (
                      <>
                        <line
                          x1={pt.x} y1={pt.y + 9}
                          x2={pt.x} y2={zeroY}
                          stroke={color}
                          strokeWidth={1}
                          strokeOpacity={0.3}
                          strokeDasharray="3 3"
                        />
                        <circle
                          className="tl-dot-ring"
                          cx={pt.x} cy={pt.y}
                          r={11}
                          stroke={color}
                          strokeOpacity={0.4}
                        />
                      </>
                    )}
                    <circle
                      className="tl-dot"
                      cx={pt.x} cy={pt.y}
                      r={r}
                      fill={isSel ? color : "rgba(10,22,40,.85)"}
                      stroke={color}
                      strokeWidth={isSel ? 0 : 2}
                    />
                    <circle className="tl-dot-hit" cx={pt.x} cy={pt.y} r={14} />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip */}
            {hovered && (
              <div
                className="tl-tooltip"
                style={{
                  left: `${hovered.x}px`,
                  top: `${hovered.y}px`,
                  transform: hovered.flip
                    ? 'translate(calc(-100% - 12px), -50%)'
                    : 'translate(12px, -50%)',
                }}
              >
                {getTitle(hovered.pt)} • {fmtDate(getDate(hovered.pt))}
              </div>
            )}
          </div>

          {/* Detail card */}
          {selected && (() => {
            const cls = badgeClass(selected);
            const color = COLORS[cls];
            const impact = getImpact(selected);
            return (
              <div
                className="tl-detail"
                key={getDate(selected) + getTitle(selected)}
                style={{ '--detail-color': color }}
              >
                <div className="tl-detail-header">
                  <div className="tl-detail-title">{getTitle(selected)}</div>
                  <div className="tl-detail-meta">
                    <div className="tl-detail-date">{fmtDate(getDate(selected))}</div>
                    {impact !== 0 && (
                      <div className={`tl-impact-chip ${impact >= 0 ? "tl-impact-pos" : "tl-impact-neg"}`}>
                        {impact >= 0 ? "+" : ""}{impact} impact
                      </div>
                    )}
                  </div>
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
