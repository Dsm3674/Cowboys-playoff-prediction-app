import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import { useSeason } from "../workspace";

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

function fmtShort(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function signed(n) { return `${n >= 0 ? "+" : ""}${n}`; }

/* ── Projected season generator ──────────────────────────────── */

/* The old fallback returned one hard-coded list of events for every season, so
   2024, 2025, 2026 and 2027 all rendered the identical chart. This builds a
   distinct, *deterministic* projection per season: the same year always yields
   the same events (no flicker between renders), but different years diverge. */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* NFL Week 1 kicks off the Thursday after Labor Day (first Monday in September). */
function weekOneThursday(year) {
  const d = new Date(Date.UTC(year, 8, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 3);
  return d;
}

function isoDay(date) { return date.toISOString().slice(0, 10); }

function gameDay(year, week, offsetDays = 0) {
  const d = weekOneThursday(year);
  /* Sunday of that week, except Week 1 which we keep on opening Thursday. */
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7 + (week === 1 ? 0 : 3) + offsetDays);
  return d;
}

const DIVISION_RIVALS = ["Philadelphia", "New York", "Washington"];
const NON_DIVISION = [
  "Green Bay", "San Francisco", "Detroit", "Tampa Bay", "Seattle", "Minnesota",
  "Atlanta", "Carolina", "Chicago", "Los Angeles", "New Orleans", "Arizona",
];

/* Impact values mirror backend/timeline.js impactForEventType so the fallback
   and the live feed speak the same language. */
const IMPACT = {
  dominant_win: 6, close_win: 5, game_win: 4,
  close_loss: -5, blowout_loss: -6, game_loss: -4,
  injury: -8, return: 7, trade: 3, signing: 4, bye: 1,
};

function projectedSeason(season) {
  const rng = mulberry32(season * 7919);
  const events = [];

  /* Season-level team strength, so each year has its own character rather than
     the same 15 canned results with the year swapped. */
  const strength = 0.48 + rng() * 0.26;          // baseline win probability
  const byeWeek  = 5 + Math.floor(rng() * 10);   // weeks 5–14

  /* Opponent slate: both meetings with each division rival, rest drawn from
     the conference pool. */
  const slate = [];
  DIVISION_RIVALS.forEach((r) => { slate.push(r, r); });
  const pool = [...NON_DIVISION];
  while (slate.length < 17) {
    slate.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  /* Deterministic shuffle so rivalry games aren't all front-loaded. */
  for (let i = slate.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slate[i], slate[j]] = [slate[j], slate[i]];
  }

  let gameIdx = 0;
  let wins = 0;
  let losses = 0;

  for (let week = 1; week <= 18; week++) {
    const date = isoDay(gameDay(season, week));

    if (week === byeWeek) {
      events.push({
        date, title: "Bye Week", type: "bye", impact: IMPACT.bye,
        description: "Rest and recovery — a chance to get banged-up starters back to full speed.",
      });
      continue;
    }

    const opponent = slate[gameIdx++];
    const home = rng() < 0.5;
    const divisional = DIVISION_RIVALS.includes(opponent);
    const margin = rng();
    /* Division games run tighter regardless of the projected edge. */
    const won = rng() < (divisional ? strength * 0.94 : strength);

    let type, title, description;
    if (won) {
      wins++;
      if (margin > 0.72)      { type = "dominant_win"; title = `Dominant Win over ${opponent}`; description = `Complete performance on both sides of the ball${divisional ? " in a division game" : ""}.`; }
      else if (margin < 0.3)  { type = "close_win";    title = `Close Win over ${opponent}`;    description = "One-score game decided in the final drive."; }
      else                    { type = "game_win";     title = `Win over ${opponent}`;          description = `${home ? "Home" : "Road"} win keeps the playoff math trending the right way.`; }
    } else {
      losses++;
      if (margin > 0.75)      { type = "blowout_loss"; title = `Blowout Loss to ${opponent}`;   description = "Never competitive — turnovers and a third-down defense that could not get off the field."; }
      else if (margin < 0.32) { type = "close_loss";   title = `Close Loss to ${opponent}`;     description = "Came down to the last possession and the ball bounced the wrong way."; }
      else                    { type = "game_loss";    title = `Loss to ${opponent}`;           description = `${home ? "Home" : "Road"} loss puts pressure on the back half of the schedule.`; }
    }

    events.push({ date, title, type, impact: IMPACT[type], description, week, opponent });
  }

  /* Roster events land midweek (+2 days = Tuesday), which is both realistic —
     injury reports and transactions happen between games — and keeps them off
     the game dates. Sharing an x with a game produced a vertical cliff in the
     cumulative line that read as an instant collapse. */
  const injuryWeek = 3 + Math.floor(rng() * 5);
  events.push({
    date: isoDay(gameDay(season, injuryWeek, 2)),
    title: "Key Starter Injured", type: "injury", impact: IMPACT.injury,
    description: "Projected multi-week absence for a front-line starter — depth gets tested early.",
  });
  events.push({
    date: isoDay(gameDay(season, Math.min(injuryWeek + 4, 17), 2)),
    title: "Starter Activated", type: "return", impact: IMPACT.return,
    description: "Back from injured reserve ahead of schedule — the rotation gets its shape back.",
  });
  events.push({
    date: isoDay(gameDay(season, 9, 2)),
    title: "Trade Deadline Move", type: "trade", impact: IMPACT.trade,
    description: "Depth added at a position of need before the deadline passes.",
  });

  /* Playoffs, if the projected record earns them. January belongs to the
     following calendar year. */
  if (wins >= 10) {
    events.push({
      date: `${season + 1}-01-11`,
      title: "Wild Card Win", type: "dominant_win", impact: IMPACT.dominant_win,
      description: `Projected ${wins}-${losses} finish is good enough to host — and to advance.`,
    });
    if (wins >= 12) {
      events.push({
        date: `${season + 1}-01-18`,
        title: "Divisional Round Loss", type: "close_loss", impact: IMPACT.close_loss,
        description: "Season ends a round short in a game decided inside the final two minutes.",
      });
    }
  } else {
    events.push({
      date: `${season + 1}-01-04`,
      title: "Season Ends", type: "game_loss", impact: IMPACT.game_loss,
      description: `Projected ${wins}-${losses} finish leaves the club on the outside looking in.`,
    });
  }

  return events.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ── SVG Layout Constants ────────────────────────────────────── */

/* viewBox *user units* — not pixels, not percentages. The chart is made
   responsive by the viewBox plus `width: 100%` on the <svg>. */
const W        = 880;
const H        = 260;
const PAD_L    = 46;
const PAD_R    = 30;
const PAD_T    = 22;
const PAD_B    = 38;

const CHART_W  = W - PAD_L - PAD_R;
const CHART_H  = H - PAD_T - PAD_B;

/* Status palette — validated against this chart's surface (#081224, dark) with
   the data-viz palette checker: lightness band, chroma floor, CVD separation
   (worst adjacent pair 9.4 ΔE deutan, above the 8.0 target), normal-vision
   floor and 3:1 contrast all pass. The previous #22c55e/#ef4444 pair sat at
   7.4 ΔE — win and loss were near-identical for red-green colorblind readers.
   Every status also carries a distinct SHAPE, so colour is never load-bearing. */
const STATUS = {
  success: { color: "#0d9488", shape: "up",      label: "Win" },
  danger:  { color: "#e11d48", shape: "down",    label: "Loss" },
  warning: { color: "#d97706", shape: "diamond", label: "Injury" },
  neutral: { color: "#8296b0", shape: "circle",  label: "Other" },
};
const STATUS_ORDER = ["success", "danger", "warning", "neutral"];

/* The momentum line is a single series, so it needs no legend — it wears the
   app's accent instead of borrowing a status hue. */
const LINE  = "#8b83ff";
const POS   = "#0d9488";
const NEG   = "#e11d48";

/* ── Mark shapes (secondary encoding for the status palette) ─── */

function markPath(shape, x, y, r) {
  switch (shape) {
    case "up":
      return `M ${x} ${y - r} L ${x + r * 0.92} ${y + r * 0.72} L ${x - r * 0.92} ${y + r * 0.72} Z`;
    case "down":
      return `M ${x} ${y + r} L ${x + r * 0.92} ${y - r * 0.72} L ${x - r * 0.92} ${y - r * 0.72} Z`;
    case "diamond":
      return `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;
    default: {
      /* circle as a path, so every mark uses the same element type */
      const k = r * 0.5523;
      return `M ${x} ${y - r} C ${x + k} ${y - r} ${x + r} ${y - k} ${x + r} ${y}`
        + ` C ${x + r} ${y + k} ${x + k} ${y + r} ${x} ${y + r}`
        + ` C ${x - k} ${y + r} ${x - r} ${y + k} ${x - r} ${y}`
        + ` C ${x - r} ${y - k} ${x - k} ${y - r} ${x} ${y - r} Z`;
    }
  }
}

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

export default function Timeline({ season: seasonProp }) {
  /* The season now comes from the workspace bar, which scopes every page at
     once. Timeline used to own a private pill row that changed only itself. */
  const contextSeason = useSeason();
  const season = seasonProp ?? contextSeason;
  const [events, setEvents]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [synthetic, setSynthetic] = useState(false);
  const [view, setView]         = useState(() => (
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches
      ? "table"
      : "chart"
  ));   // "chart" | "table"
  const [hovered, setHovered]   = useState(null);
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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
        setSynthetic(false);
      } catch {
        if (!cancelled) {
          const syn = projectedSeason(season);
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

  useEffect(() => { setHovered(null); }, [events]);

  /* ── Derive chart data ───────────────────────────────────────── */

  const { plotPoints, zeroY, monthTicks, yLabels, stats } = useMemo(() => {
    const empty = { plotPoints: [], zeroY: 0, monthTicks: [], yLabels: [], stats: null };
    if (!events.length) return empty;

    /* `_src` references the original event: plot points are date-filtered and
       re-sorted, so their index is NOT the index in `events`. */
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

    const plotPoints = withCumul.map((e) => ({ ...e, x: toX(e._ts), y: toY(e.cumul) }));

    /* One label per month, centred over the portion of that month actually in
       range, so a season opening mid-September still gets a "Sep" label rather
       than none. Gridlines mark true month boundaries only, and a month too
       narrow to hold its label is left unlabelled instead of colliding. */
    const monthTicks = [];
    const cursor = new Date(minTs);
    cursor.setDate(1);
    while (cursor.getTime() <= maxTs) {
      const start = cursor.getTime();
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + 1);
      const end = next.getTime();

      const from = Math.max(start, minTs);
      const to   = Math.min(end, maxTs);
      if (to > from && toX(to) - toX(from) >= 26) {
        monthTicks.push({
          x: toX((from + to) / 2),
          gridX: start >= minTs ? toX(start) : null,
          label: cursor.toLocaleDateString(undefined, { month: "short" }),
        });
      }
      cursor.setTime(end);
    }

    const step = Math.max(1, Math.ceil(cRange / 4));
    const yLabels = [];
    for (let v = Math.ceil(minCumul / step) * step; v <= maxCumul; v += step) {
      if (v === 0) continue;
      yLabels.push({ y: toY(v), label: signed(v) });
    }

    /* Headline numbers — computed from exactly what is plotted, so the tiles
       can never disagree with the chart. */
    const impacts  = withCumul.map(getImpact);
    const peakIdx  = plotPoints.reduce((best, p, i) => (p.cumul > plotPoints[best].cumul ? i : best), 0);
    const swingIdx = impacts.reduce((best, v, i) => (Math.abs(v) > Math.abs(impacts[best]) ? i : best), 0);
    const stats = {
      net: running,
      positive: impacts.filter((v) => v > 0).length,
      negative: impacts.filter((v) => v < 0).length,
      peak: plotPoints[peakIdx],
      swing: plotPoints[swingIdx],
      last: plotPoints[plotPoints.length - 1],
    };

    return { plotPoints, zeroY: toY(0), monthTicks, yLabels, stats };
  }, [events]);

  const abovePts = plotPoints.map((p) => ({ ...p, y: Math.min(p.y, zeroY) }));
  const belowPts = plotPoints.map((p) => ({ ...p, y: Math.max(p.y, zeroY) }));

  const linePath  = smoothPath(plotPoints);
  const aboveArea = areaPath(abovePts, zeroY);
  const belowArea = areaPath(belowPts, zeroY);

  const selectedIdx = selected ? plotPoints.findIndex((p) => p._src === selected) : -1;

  /* Direct labels: the endpoint always, plus the peak when it is somewhere
     else. Never a number on every point. */
  const directLabels = useMemo(() => {
    if (!stats || plotPoints.length < 2) return [];
    const out = [{ pt: stats.last, text: signed(stats.last.cumul), anchor: "end" }];
    if (stats.peak && stats.peak !== stats.last && stats.peak.cumul > stats.last.cumul) {
      out.push({ pt: stats.peak, text: signed(stats.peak.cumul), anchor: "middle" });
    }
    return out;
  }, [stats, plotPoints]);

  /* ── Tooltip positioning ─────────────────────────────────────── */

  const showTip = useCallback((pt) => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || typeof svg.getScreenCTM !== "function") {
      setHovered({ pt, x: 0, y: 0, flip: false });
      return;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const sp = svg.createSVGPoint();
    sp.x = pt.x; sp.y = pt.y;
    const screen = sp.matrixTransform(ctm);
    const wrapRect = wrap.getBoundingClientRect();
    const x = screen.x - wrapRect.left + wrap.scrollLeft;
    const y = screen.y - wrapRect.top + wrap.scrollTop;
    setHovered({ pt, x, y, flip: x - wrap.scrollLeft > wrap.clientWidth * 0.6 });
  }, []);

  /* Keyboard selection surfaces the same readout as hover. */
  const select = useCallback((pt) => {
    setSelected(pt._src);
    showTip(pt);
  }, [showTip]);

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
    select(plotPoints[next]);
  };

  const trendWord = !stats ? "" : stats.net > 5 ? "Trending up" : stats.net < -5 ? "Trending down" : "Holding flat";

  return (
    <div className="tl-root">
      <style>{`
        .tl-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: #e2e8f0;
        }

        /* One filter row above everything it scopes. */
        .tl-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .tl-season-selector { display: flex; gap: 6px; align-items: center; }

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
          border-color: rgba(139,131,255,0.45);
          background: rgba(139,131,255,0.09);
          color: rgba(255,255,255,0.85);
        }
        .tl-season-pill.active {
          background: linear-gradient(135deg, #6c63ff, #a78bfa);
          color: #fff;
          border-color: #6c63ff;
        }

        .tl-synthetic-note {
          font-size: 11px;
          color: #d9a441;
          background: rgba(217,164,65,.07);
          border: 1px solid rgba(217,164,65,.2);
          border-radius: 6px;
          padding: 5px 10px;
        }

        /* SUMMARY TILES — the headline the chart cannot say in one glance */
        .tl-tiles {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 1rem;
        }
        .tl-tile {
          background: rgba(10,22,40,.8);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .tl-tile-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: #5c7391;
          margin-bottom: 6px;
        }
        .tl-tile-value {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          line-height: 1.1;
        }
        .tl-tile-sub {
          font-size: 11px;
          color: #7a8fa8;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* LEGEND + VIEW TOGGLE */
        .tl-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .tl-legend {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          align-items: center;
        }
        .tl-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #8ea3bd;
        }
        .tl-view-toggle { display: flex; gap: 4px; }
        .tl-view-btn {
          padding: 5px 12px;
          font-size: 11.5px;
          font-weight: 600;
          border-radius: 7px;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.03);
          color: #8ea3bd;
          cursor: pointer;
        }
        .tl-view-btn.active {
          background: rgba(139,131,255,.14);
          border-color: rgba(139,131,255,.4);
          color: #cfcaff;
        }

        /* CHART CONTAINER */
        .tl-chart-wrap {
          background: rgba(8,18,36,.97);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px;
          padding: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          margin-bottom: 1.25rem;
          position: relative;
          transition: opacity .18s ease;
        }
        .tl-chart-wrap:focus-visible {
          outline: 2px solid rgba(139,131,255,.7);
          outline-offset: 2px;
        }
        /* Hold the previous render while refetching — no skeleton flash. */
        .tl-stale { opacity: .45; }

        .tl-chart-wrap svg {
          display: block;
          width: 100%;
          height: auto;
          min-width: 640px;
        }

        /* Solid hairlines — dashed grid reads as "projection". */
        .tl-grid-line { stroke: rgba(255,255,255,.045); stroke-width: 1; }
        .tl-zero-line { stroke: rgba(255,255,255,.2);  stroke-width: 1; }
        .tl-crosshair { stroke: rgba(255,255,255,.16); stroke-width: 1; pointer-events: none; }

        .tl-tick-label {
          fill: rgba(255,255,255,.32);
          font-size: 10.5px;
          font-family: var(--font-mono, monospace);
          letter-spacing: .05em;
        }
        .tl-direct-label {
          fill: #cfd8e6;
          font-size: 11.5px;
          font-weight: 700;
          font-family: var(--font-mono, monospace);
          paint-order: stroke;
          stroke: #081224;
          stroke-width: 3px;
          stroke-linejoin: round;
        }

        .tl-line {
          fill: none;
          stroke: ${LINE};
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .tl-area-above { fill: url(#tl-grad-above); }
        .tl-area-below { fill: url(#tl-grad-below); }

        /* 2px surface ring keeps overlapping marks separate without a border. */
        .tl-mark { stroke: #081224; stroke-width: 2; paint-order: stroke; cursor: pointer; }
        .tl-mark-ring { fill: none; stroke-width: 1.5; pointer-events: none; }
        .tl-hit { fill: transparent; cursor: pointer; }

        .tl-tooltip {
          position: absolute;
          background: rgba(12,24,44,0.97);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 12px;
          color: #e2e8f0;
          pointer-events: none;
          z-index: 10;
          white-space: nowrap;
          box-shadow: 0 8px 22px rgba(0,0,0,.45);
        }
        .tl-tt-title { font-weight: 700; margin-bottom: 3px; }
        .tl-tt-row {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: #93a7c0;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        /* TABLE VIEW — the WCAG-clean twin of the chart */
        .tl-table-wrap {
          background: rgba(8,18,36,.97);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px;
          margin-bottom: 1.25rem;
          max-height: 420px;
          overflow: auto;
        }
        .tl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .tl-table th {
          position: sticky;
          top: 0;
          background: #0b1830;
          text-align: left;
          font-size: 10px;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #5c7391;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .tl-table td {
          padding: 9px 14px;
          border-bottom: 1px solid rgba(255,255,255,.04);
          color: #b9c7d9;
        }
        .tl-table tbody tr { cursor: pointer; }
        .tl-table tbody tr:hover { background: rgba(139,131,255,.07); }
        .tl-table tbody tr.active { background: rgba(139,131,255,.13); }
        .tl-num { font-family: var(--font-mono, monospace); text-align: right; }
        .tl-type-cell { display: inline-flex; align-items: center; gap: 7px; }

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
        .tl-detail-header { margin-bottom: 1rem; }
        .tl-detail-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .tl-detail-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
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
        .tl-impact-pos { background: rgba(13,148,136,.16); color: #2dd4bf; }
        .tl-impact-neg { background: rgba(225,29,72,.16);  color: #fb7185; }
        .tl-detail-body { font-size: 14px; line-height: 1.6; color: #a1aec5; }

        @media (max-width: 1024px) {
          .tl-header { flex-direction: column; align-items: flex-start; }
          .tl-season-selector { width: 100%; justify-content: space-between; }
        }

        @media (max-width: 768px) {
          .tl-header { flex-direction: column; gap: 12px; }
          .tl-season-selector { flex-wrap: wrap; gap: 8px; }
          .tl-season-pill { padding: 6px 12px; font-size: 12px; }
          .tl-chart-wrap { padding: 8px; }
          .tl-tile-value { font-size: 19px; }
          .tl-detail { padding: 1.25rem; }
          .tl-detail-title { font-size: 15px; }
          .tl-detail-body { font-size: 13px; }
        }

        @media (max-width: 480px) {
          .tl-season-pill { padding: 5px 10px; font-size: 11px; }
          .tl-chart-wrap, .tl-table-wrap { border-radius: 12px; }
          .tl-detail { padding: 1rem; border-left-width: 3px; }
          .tl-detail-title { font-size: 14px; }
          .tl-detail-meta { flex-direction: column; align-items: flex-start; gap: 6px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tl-detail { animation: none; }
          .tl-chart-wrap { transition: none; }
        }
      `}</style>

      {synthetic && (
        <div className="tl-header">
          <span className="tl-synthetic-note">
            Projected {season} season — simulated while live events are unavailable
          </span>
        </div>
      )}

      {loading && !plotPoints.length ? (
        <div className="tl-loading">Loading momentum data…</div>
      ) : (
        <>
          {/* Headline numbers */}
          {stats && (
            <div className="tl-tiles">
              <div className="tl-tile">
                <div className="tl-tile-label">Net momentum</div>
                <div className="tl-tile-value" style={{ color: stats.net >= 0 ? "#2dd4bf" : "#fb7185" }}>
                  {signed(stats.net)}
                </div>
                <div className="tl-tile-sub">{trendWord}</div>
              </div>
              <div className="tl-tile">
                <div className="tl-tile-label">Positive events</div>
                <div className="tl-tile-value">{stats.positive}</div>
                <div className="tl-tile-sub">of {plotPoints.length} tracked</div>
              </div>
              <div className="tl-tile">
                <div className="tl-tile-label">Negative events</div>
                <div className="tl-tile-value">{stats.negative}</div>
                <div className="tl-tile-sub">of {plotPoints.length} tracked</div>
              </div>
              <div className="tl-tile">
                <div className="tl-tile-label">Biggest swing</div>
                <div className="tl-tile-value" style={{ color: getImpact(stats.swing) >= 0 ? "#2dd4bf" : "#fb7185" }}>
                  {signed(getImpact(stats.swing))}
                </div>
                <div className="tl-tile-sub" title={getTitle(stats.swing)}>{getTitle(stats.swing)}</div>
              </div>
            </div>
          )}

          {/* Legend (identity is never colour-alone) + view toggle */}
          <div className="tl-meta-row">
            <div className="tl-legend">
              {STATUS_ORDER.map((key) => {
                const s = STATUS[key];
                return (
                  <span className="tl-legend-item" key={key}>
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d={markPath(s.shape, 7, 7, 5)} fill={s.color} />
                    </svg>
                    {s.label}
                  </span>
                );
              })}
            </div>
            <div className="tl-view-toggle" role="group" aria-label="Timeline view">
              {["chart", "table"].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`tl-view-btn ${view === v ? "active" : ""}`}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === "chart" ? "Chart" : "Table"}
                </button>
              ))}
            </div>
          </div>

          {view === "chart" ? (
            <div
              className={`tl-chart-wrap ${loading ? "tl-stale" : ""}`}
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
                aria-label={`Cumulative momentum across the ${season} season, ending at ${stats ? signed(stats.net) : 0}`}
              >
                <defs>
                  <linearGradient id="tl-grad-above" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%"   stopColor={POS} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={POS} stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="tl-grad-below" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%"   stopColor={NEG} stopOpacity="0.02" />
                    <stop offset="100%" stopColor={NEG} stopOpacity="0.26" />
                  </linearGradient>
                </defs>

                {yLabels.map((lbl, i) => (
                  <g key={`grid-${i}`}>
                    <line className="tl-grid-line" x1={PAD_L} y1={lbl.y} x2={W - PAD_R} y2={lbl.y} />
                    <text className="tl-tick-label" x={PAD_L - 9} y={lbl.y + 3.5} textAnchor="end">{lbl.label}</text>
                  </g>
                ))}

                <line className="tl-zero-line" x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} />
                <text className="tl-tick-label" x={PAD_L - 9} y={zeroY + 3.5} textAnchor="end"
                  style={{ fill: 'rgba(255,255,255,.5)' }}>0</text>

                {monthTicks.map((tick, i) => (
                  <g key={`month-${i}`}>
                    {tick.gridX !== null && (
                      <line className="tl-grid-line" x1={tick.gridX} y1={PAD_T} x2={tick.gridX} y2={H - PAD_B + 3} />
                    )}
                    <text className="tl-tick-label" x={tick.x} y={H - PAD_B + 17} textAnchor="middle">{tick.label}</text>
                  </g>
                ))}

                {plotPoints.length > 1 && (
                  <>
                    <path className="tl-area-above" d={aboveArea} />
                    <path className="tl-area-below" d={belowArea} />
                    <path className="tl-line" d={linePath} />
                  </>
                )}

                {/* Crosshair on hover */}
                {hovered && (
                  <line className="tl-crosshair"
                    x1={hovered.pt.x} y1={PAD_T} x2={hovered.pt.x} y2={H - PAD_B} />
                )}

                {/* Event marks — colour AND shape carry the status */}
                {plotPoints.map((pt, i) => {
                  const s     = STATUS[badgeClass(pt)];
                  const isSel = selectedIdx === i;
                  const isHot = hovered?.pt === pt;
                  const r     = isSel ? 7 : isHot ? 6.5 : 5;

                  return (
                    <g
                      key={`mark-${i}`}
                      onClick={() => select(pt)}
                      onMouseEnter={() => showTip(pt)}
                    >
                      {isSel && (
                        <circle className="tl-mark-ring" cx={pt.x} cy={pt.y} r={11}
                          stroke={s.color} strokeOpacity={0.5} />
                      )}
                      <path className="tl-mark" d={markPath(s.shape, pt.x, pt.y, r)} fill={s.color} />
                      <circle className="tl-hit" cx={pt.x} cy={pt.y} r={14} />
                    </g>
                  );
                })}

                {/* Selective direct labels — endpoint and peak only */}
                {directLabels.map((l, i) => (
                  <text
                    key={`dl-${i}`}
                    className="tl-direct-label"
                    x={l.anchor === "end" ? l.pt.x + 10 : l.pt.x}
                    y={l.anchor === "end" ? l.pt.y + 4 : l.pt.y - 12}
                    textAnchor={l.anchor === "end" ? "start" : "middle"}
                  >
                    {l.text}
                  </text>
                ))}
              </svg>

              {hovered && (
                <div
                  className="tl-tooltip"
                  style={{
                    left: `${hovered.x}px`,
                    top: `${hovered.y}px`,
                    transform: hovered.flip
                      ? 'translate(calc(-100% - 14px), -50%)'
                      : 'translate(14px, -50%)',
                  }}
                >
                  <div className="tl-tt-title">{getTitle(hovered.pt)}</div>
                  <div className="tl-tt-row"><span>{fmtShort(getDate(hovered.pt))}</span></div>
                  <div className="tl-tt-row">
                    <span>Impact</span><span>{signed(getImpact(hovered.pt))}</span>
                  </div>
                  <div className="tl-tt-row">
                    <span>Running</span><span>{signed(hovered.pt.cumul)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`tl-table-wrap ${loading ? "tl-stale" : ""}`}>
              <table className="tl-table">
                <caption className="tl-loading" style={{ display: "none" }}>
                  {season} season momentum events
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Event</th>
                    <th scope="col">Type</th>
                    <th scope="col" style={{ textAlign: "right" }}>Impact</th>
                    <th scope="col" style={{ textAlign: "right" }}>Running</th>
                  </tr>
                </thead>
                <tbody>
                  {plotPoints.map((pt, i) => {
                    const s = STATUS[badgeClass(pt)];
                    return (
                      <tr
                        key={`row-${i}`}
                        className={selectedIdx === i ? "active" : ""}
                        onClick={() => setSelected(pt._src)}
                      >
                        <td data-label="Date" className="tl-num" style={{ textAlign: "left" }}>{fmtShort(getDate(pt))}</td>
                        <td data-label="Event">{getTitle(pt)}</td>
                        <td data-label="Type">
                          <span className="tl-type-cell">
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                              <path d={markPath(s.shape, 6, 6, 4.5)} fill={s.color} />
                            </svg>
                            {s.label}
                          </span>
                        </td>
                        <td data-label="Impact" className="tl-num" style={{ color: getImpact(pt) >= 0 ? "#2dd4bf" : "#fb7185" }}>
                          {signed(getImpact(pt))}
                        </td>
                        <td data-label="Running" className="tl-num">{signed(pt.cumul)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selected && (() => {
            const s = STATUS[badgeClass(selected)];
            const impact = getImpact(selected);
            return (
              <div
                className="tl-detail"
                key={getDate(selected) + getTitle(selected)}
                style={{ '--detail-color': s.color }}
              >
                <div className="tl-detail-header">
                  <div className="tl-detail-title">{getTitle(selected)}</div>
                  <div className="tl-detail-meta">
                    <div className="tl-detail-date">{fmtDate(getDate(selected))}</div>
                    {impact !== 0 && (
                      <div className={`tl-impact-chip ${impact >= 0 ? "tl-impact-pos" : "tl-impact-neg"}`}>
                        {signed(impact)} impact
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
