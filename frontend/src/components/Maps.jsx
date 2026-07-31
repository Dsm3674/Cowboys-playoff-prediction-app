import React from "react";
import { api } from "../api";
import { useSeason } from "../workspace";

/**
 * Performance Map — consistency against explosiveness, as a quadrant scatter.
 *
 * The previous version called drawMap() and handleCanvasHover(), neither of
 * which existed anywhere in the file (they were deleted and replaced with a
 * "keep ALL your existing draw functions unchanged" comment), so the component
 * threw a ReferenceError the moment data arrived. This is a rebuild.
 *
 * Design notes, because a few choices here are deliberate:
 *
 *  - Category is NOT encoded with colour. The four categories are exactly the
 *    four quadrants, so position already says which one a player is in;
 *    colouring by category would spend the colour channel restating what the
 *    axes show. One series hue, and the quadrants are named in the corners.
 *  - The quadrant split is at 65 on both axes, matching categorizePlayer() in
 *    backend/Maps.js. Drawing it at the midpoint would visually contradict the
 *    labels the server assigns.
 *  - Coincident points are dispersed on a small deterministic spiral. Scores
 *    are clamped and rounded server-side, so bench players pile up on exactly
 *    the same coordinate and a plain scatter would draw 20 players as 1 dot.
 *  - Hover uses a nearest-point search rather than exact hit-testing, so you
 *    don't have to land dead-centre on a 5px dot.
 *  - Labels are placed selectively with collision avoidance — a name on every
 *    point is unreadable at this density.
 *  - The canvas is mirrored by a table view, since a canvas is opaque to
 *    screen readers.
 */

/* Single series hue — validated for contrast against the panel surface. */
const SERIES       = "#3987e5";
const SERIES_HI    = "#8fc0f5";
const MUTED        = "#44566f";
const SURFACE      = "#0b1730";
const INK          = "#8ea3bd";
const INK_FAINT    = "rgba(255,255,255,.28)";

/* Matches categorizePlayer() in backend/Maps.js. */
const SPLIT = 65;
const DOMAIN_MIN = 15;
const DOMAIN_MAX = 100;

const PAD = { l: 56, r: 22, t: 26, b: 48 };

const CATEGORIES = [
  { id: "elite",        label: "Quietly Elite",       hint: "High consistency · high explosiveness" },
  { id: "volatile",     label: "Volatile Talent",     hint: "Low consistency · high explosiveness" },
  { id: "reliable",     label: "Reliable Role Player", hint: "High consistency · low explosiveness" },
  { id: "inconsistent", label: "Needs Lift",          hint: "Low consistency · low explosiveness" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

/* Quadrant captions drawn in the plot corners. */
const QUADRANTS = [
  { id: "elite",        corner: "tr", text: "QUIETLY ELITE" },
  { id: "volatile",     corner: "tl", text: "VOLATILE TALENT" },
  { id: "reliable",     corner: "br", text: "RELIABLE ROLE PLAYERS" },
  { id: "inconsistent", corner: "bl", text: "NEEDS LIFT" },
];

function Maps({ season: seasonProp }) {
  const contextSeason = useSeason();
  const season = seasonProp ?? contextSeason;
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const pointsRef = React.useRef([]);

  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [hovered, setHovered] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [category, setCategory] = React.useState(null);
  const [showLabels, setShowLabels] = React.useState(true);
  const [view, setView] = React.useState("map");
  const [size, setSize] = React.useState({ w: 820, h: 560 });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await api.getPlayerMaps(season);
        if (!cancelled) { setData(result); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not load the performance map.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [season]);

  /* Size the canvas to its container instead of a fixed 800×600. */
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(320, Math.floor(entry.contentRect.width));
        setSize({ w, h: Math.max(360, Math.min(620, Math.round(w * 0.68))) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const players = React.useMemo(
    () => (Array.isArray(data?.players) ? data.players : []),
    [data]
  );

  /* ── Layout ─────────────────────────────────────────────────── */

  const layout = React.useMemo(() => {
    const plotW = Math.max(40, size.w - PAD.l - PAD.r);
    const plotH = Math.max(40, size.h - PAD.t - PAD.b);
    const span = DOMAIN_MAX - DOMAIN_MIN;
    const toX = (v) => PAD.l + ((clamp(v) - DOMAIN_MIN) / span) * plotW;
    const toY = (v) => PAD.t + plotH - ((clamp(v) - DOMAIN_MIN) / span) * plotH;
    return { plotW, plotH, toX, toY };
  }, [size]);

  function clamp(v) {
    return Math.max(DOMAIN_MIN, Math.min(DOMAIN_MAX, Number(v) || 0));
  }

  /**
   * Screen positions, with coincident points pushed apart.
   *
   * Server-side scores are rounded integers clamped to a floor, so a whole
   * bench can land on one pixel. Points sharing a cell are laid out on a
   * spiral around it — deterministic, so the map doesn't reshuffle on redraw.
   */
  const points = React.useMemo(() => {
    const { toX, toY } = layout;
    const cells = new Map();
    const placed = players.map((p) => {
      const bx = toX(p.consistency);
      const by = toY(p.explosiveness);
      const key = `${Math.round(bx / 7)}:${Math.round(by / 7)}`;
      const seat = cells.get(key) || 0;
      cells.set(key, seat + 1);
      return { player: p, bx, by, seat };
    });

    return placed.map(({ player, bx, by, seat }) => {
      if (seat === 0) return { player, x: bx, y: by };
      /* Golden-angle spiral: even coverage, no clustering artefacts. */
      const angle = seat * 2.399963;
      const radius = 5.5 * Math.sqrt(seat);
      return {
        player,
        x: bx + Math.cos(angle) * radius,
        y: by + Math.sin(angle) * radius,
      };
    });
  }, [players, layout]);

  React.useEffect(() => { pointsRef.current = points; }, [points]);

  const visible = React.useMemo(
    () => (category ? points.filter((p) => p.player.category === category) : points),
    [points, category]
  );

  /* ── Drawing ────────────────────────────────────────────────── */

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || view !== "map") return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const { plotW, plotH, toX, toY } = layout;
    const splitX = toX(SPLIT);
    const splitY = toY(SPLIT);
    const right = PAD.l + plotW;
    const bottom = PAD.t + plotH;

    ctx.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";

    /* Faint wash on the top-right quadrant — the one to aim for. */
    ctx.fillStyle = "rgba(57,135,229,.05)";
    ctx.fillRect(splitX, PAD.t, right - splitX, splitY - PAD.t);

    /* Gridlines: solid hairlines, one shade off the surface. */
    ctx.strokeStyle = "rgba(255,255,255,.05)";
    ctx.lineWidth = 1;
    for (let v = 20; v <= 100; v += 20) {
      const gx = Math.round(toX(v)) + 0.5;
      const gy = Math.round(toY(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(gx, PAD.t); ctx.lineTo(gx, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD.l, gy); ctx.lineTo(right, gy); ctx.stroke();
    }

    /* Quadrant split at 65 — the boundary the server actually classifies on. */
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.beginPath();
    ctx.moveTo(Math.round(splitX) + 0.5, PAD.t);
    ctx.lineTo(Math.round(splitX) + 0.5, bottom);
    ctx.moveTo(PAD.l, Math.round(splitY) + 0.5);
    ctx.lineTo(right, Math.round(splitY) + 0.5);
    ctx.stroke();

    /* Axis ticks */
    ctx.fillStyle = INK_FAINT;
    ctx.textAlign = "center";
    for (let v = 20; v <= 100; v += 20) {
      ctx.fillText(String(v), toX(v), bottom + 14);
    }
    ctx.textAlign = "right";
    for (let v = 20; v <= 100; v += 20) {
      ctx.fillText(String(v), PAD.l - 10, toY(v));
    }

    /* Axis titles */
    ctx.fillStyle = INK;
    ctx.font = "700 10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CONSISTENCY →", PAD.l + plotW / 2, bottom + 34);
    ctx.save();
    ctx.translate(16, PAD.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("EXPLOSIVENESS →", 0, 0);
    ctx.restore();

    /* Quadrant captions */
    ctx.font = "700 9.5px ui-sans-serif, system-ui, sans-serif";
    for (const q of QUADRANTS) {
      const dim = category && category !== q.id;
      ctx.fillStyle = dim ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.32)";
      const isRight = q.corner.endsWith("r");
      const isTop = q.corner.startsWith("t");
      ctx.textAlign = isRight ? "right" : "left";
      ctx.fillText(
        q.text,
        isRight ? right - 10 : PAD.l + 10,
        isTop ? PAD.t + 12 : bottom - 12
      );
    }

    /* Dots. Filtered-out players stay on the map, greyed — removing them
       would make the distribution look different rather than focused. */
    const dimmed = category ? points.filter((p) => p.player.category !== category) : [];
    for (const pt of dimmed) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = MUTED;
      ctx.globalAlpha = 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const pt of visible) {
      const isActive = pt.player.id === (hovered?.player.id || selected?.player.id);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? SERIES_HI : SERIES;
      ctx.fill();
      /* 2px surface ring so overlapping marks stay separable. */
      ctx.lineWidth = 2;
      ctx.strokeStyle = SURFACE;
      ctx.stroke();
    }

    /* Ring the active point so it reads at a glance. */
    const active = hovered || selected;
    if (active) {
      ctx.beginPath();
      ctx.arc(active.x, active.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = SERIES_HI;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* Selective labels with collision avoidance. Standouts get a name; the
       rest are reachable by hover, keyboard and the table. */
    if (showLabels) {
      ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
      const boxes = [];
      const ranked = [...visible].sort(
        (a, b) =>
          (b.player.consistency + b.player.explosiveness) -
          (a.player.consistency + a.player.explosiveness)
      );
      const candidates = [];
      if (active) candidates.push(active);
      candidates.push(...ranked.slice(0, 14).filter((p) => p !== active));

      for (const pt of candidates) {
        const text = pt.player.name;
        const w = ctx.measureText(text).width;
        const h = 13;
        /* right, left, above, below */
        const options = [
          { x: pt.x + 10, y: pt.y - h / 2, align: "left" },
          { x: pt.x - 10 - w, y: pt.y - h / 2, align: "left" },
          { x: pt.x - w / 2, y: pt.y - 18, align: "left" },
          { x: pt.x - w / 2, y: pt.y + 8, align: "left" },
        ];
        const spot = options.find((o) =>
          o.x >= PAD.l && o.x + w <= right && o.y >= PAD.t && o.y + h <= bottom &&
          !boxes.some((b) => o.x < b.x + b.w && o.x + w > b.x && o.y < b.y + b.h && o.y + h > b.y));
        if (!spot) continue;

        boxes.push({ x: spot.x, y: spot.y, w, h });
        ctx.textAlign = "left";
        /* Halo so names stay legible over dots and gridlines. */
        ctx.lineWidth = 3;
        ctx.strokeStyle = SURFACE;
        ctx.strokeText(text, spot.x, spot.y + h / 2);
        ctx.fillStyle = pt === active ? "#ffffff" : "rgba(226,232,240,.82)";
        ctx.fillText(text, spot.x, spot.y + h / 2);
      }
    }
  }, [points, visible, size, layout, hovered, selected, category, showLabels, view]);

  /* ── Interaction ────────────────────────────────────────────── */

  /** Nearest point within a forgiving radius, rather than exact hit-testing. */
  function nearest(px, py) {
    let best = null;
    let bestDist = 26 * 26;
    for (const pt of visible) {
      const dx = pt.x - px;
      const dy = pt.y - py;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = pt; }
    }
    return best;
  }

  function handleMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    setHovered(nearest(e.clientX - rect.left, e.clientY - rect.top));
  }

  function handleClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const hit = nearest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) setSelected(hit);
  }

  function handleKey(e) {
    if (!visible.length) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const order = [...visible].sort((a, b) => a.x - b.x || a.y - b.y);
    const idx = selected ? order.findIndex((p) => p.player.id === selected.player.id) : -1;
    const next = e.key === "ArrowRight"
      ? Math.min(order.length - 1, idx + 1)
      : Math.max(0, idx <= 0 ? 0 : idx - 1);
    setSelected(order[next]);
  }

  const active = hovered || selected;

  /* ── States ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div>
            <div className="intel-kicker">Player Intelligence</div>
            <h1 className="intel-title">Performance Map</h1>
            <p className="intel-subtitle">Building the consistency and explosiveness plot…</p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intel-page">
        <div className="intel-banner intel-banner--warning">{error}</div>
      </div>
    );
  }

  if (!players.length) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">Player Intelligence</div>
            <h1 className="intel-title">Performance Map</h1>
            <p className="intel-subtitle">
              No player snaps have been recorded yet. The map fills in once the season's
              play-by-play starts arriving.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const counts = CATEGORIES.map((c) => ({
    ...c,
    n: players.filter((p) => p.category === c.id).length,
  }));

  return (
    <div className="intel-page pmap-root">
      <style>{`
        .pmap-canvas-wrap { position: relative; width: 100%; }
        .pmap-canvas {
          display: block;
          width: 100%;
          border-radius: 12px;
          background: ${SURFACE};
          cursor: crosshair;
        }
        .pmap-canvas:focus-visible { outline: 2px solid rgba(57,135,229,.7); outline-offset: 2px; }
        .pmap-tip {
          position: absolute;
          pointer-events: none;
          background: rgba(12,24,44,.97);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 12px;
          color: #e2e8f0;
          white-space: nowrap;
          z-index: 5;
          box-shadow: 0 8px 22px rgba(0,0,0,.45);
        }
        .pmap-tip__name { font-weight: 700; margin-bottom: 3px; }
        .pmap-tip__row {
          display: flex; justify-content: space-between; gap: 12px;
          font-family: ui-monospace, monospace; font-size: 11px; color: #93a7c0;
        }
        .pmap-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; margin-bottom: 10px;
        }
        .pmap-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .pmap-chip {
          padding: 5px 11px; font-size: 11.5px; font-weight: 600;
          border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.03); color: #8ea3bd;
        }
        .pmap-chip.is-on {
          background: rgba(57,135,229,.16);
          border-color: rgba(57,135,229,.5);
          color: #cfe3fb;
        }
        .pmap-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .pmap-table th {
          position: sticky; top: 0; background: #0b1830; text-align: left;
          font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
          color: #5c7391; padding: 10px 12px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .pmap-table td {
          padding: 8px 12px; color: #b9c7d9;
          border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .pmap-table tbody tr { cursor: pointer; }
        .pmap-table tbody tr:hover { background: rgba(57,135,229,.07); }
        .pmap-table tbody tr.is-on { background: rgba(57,135,229,.13); }
        .pmap-num { font-family: ui-monospace, monospace; text-align: right; }
        .pmap-scroll { max-height: 460px; overflow: auto; }
        @media (prefers-reduced-motion: reduce) { .pmap-canvas { transition: none; } }
      `}</style>

      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Player Intelligence</div>
          <h1 className="intel-title">Consistency vs Explosiveness</h1>
          <p className="intel-subtitle">
            Every rostered player placed by how reliably they produce against how often
            they break a game open. The split is at 65 on both axes.
          </p>
        </div>
        <div className="intel-hero__meta">
          <div className="intel-chip">{players.length} Players</div>
          {active && <div className="intel-chip intel-chip--muted">{active.player.name}</div>}
        </div>
      </section>

      <section className="intel-grid intel-grid--main">
        <article className="intel-panel intel-panel--primary">
          <div className="pmap-toolbar">
            <div className="pmap-chips">
              <button
                type="button"
                className={`pmap-chip ${category === null ? "is-on" : ""}`}
                onClick={() => setCategory(null)}
              >
                All {players.length}
              </button>
              {counts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.hint}
                  className={`pmap-chip ${category === c.id ? "is-on" : ""}`}
                  onClick={() => setCategory(category === c.id ? null : c.id)}
                >
                  {c.label} {c.n}
                </button>
              ))}
            </div>
            <div className="pmap-chips">
              <button
                type="button"
                className={`pmap-chip ${showLabels ? "is-on" : ""}`}
                onClick={() => setShowLabels((v) => !v)}
              >
                Labels
              </button>
              <button
                type="button"
                className={`pmap-chip ${view === "map" ? "is-on" : ""}`}
                onClick={() => setView("map")}
              >
                Map
              </button>
              <button
                type="button"
                className={`pmap-chip ${view === "table" ? "is-on" : ""}`}
                onClick={() => setView("table")}
              >
                Table
              </button>
            </div>
          </div>

          {view === "map" ? (
            <div className="pmap-canvas-wrap" ref={wrapRef}>
              <canvas
                ref={canvasRef}
                className="pmap-canvas"
                tabIndex={0}
                role="img"
                aria-label={
                  `Scatter plot of ${players.length} players by consistency and explosiveness. `
                  + `Use the table view for the underlying numbers.`
                }
                onMouseMove={handleMove}
                onMouseLeave={() => setHovered(null)}
                onClick={handleClick}
                onKeyDown={handleKey}
              />
              {active && (
                <div
                  className="pmap-tip"
                  style={{
                    left: `${active.x}px`,
                    top: `${active.y}px`,
                    transform: active.x > size.w * 0.62
                      ? "translate(calc(-100% - 16px), -50%)"
                      : "translate(16px, -50%)",
                  }}
                >
                  <div className="pmap-tip__name">{active.player.name}</div>
                  <div className="pmap-tip__row">
                    <span>{active.player.position}</span>
                    <span>{CATEGORY_LABEL[active.player.category] || active.player.category}</span>
                  </div>
                  <div className="pmap-tip__row">
                    <span>Consistency</span><span>{active.player.consistency}</span>
                  </div>
                  <div className="pmap-tip__row">
                    <span>Explosiveness</span><span>{active.player.explosiveness}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pmap-scroll">
              <table className="pmap-table">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Pos</th>
                    <th scope="col">Category</th>
                    <th scope="col" style={{ textAlign: "right" }}>Consistency</th>
                    <th scope="col" style={{ textAlign: "right" }}>Explosiveness</th>
                  </tr>
                </thead>
                <tbody>
                  {(category ? players.filter((p) => p.category === category) : players).map((p) => (
                    <tr
                      key={p.id}
                      className={selected?.player.id === p.id ? "is-on" : ""}
                      onClick={() => setSelected(points.find((pt) => pt.player.id === p.id) || null)}
                    >
                      <td>{p.name}</td>
                      <td>{p.position}</td>
                      <td>{CATEGORY_LABEL[p.category] || p.category}</td>
                      <td className="pmap-num">{p.consistency}</td>
                      <td className="pmap-num">{p.explosiveness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <div className="intel-stack">
          <article className="intel-panel">
            <div className="intel-panel__header">
              <h3 className="intel-section-title">Quadrants</h3>
            </div>
            <div className="intel-stack">
              {counts.map((c) => (
                <div key={c.id} className="intel-bar-row">
                  <div className="intel-bar-header">
                    <div className="intel-bar-label">{c.label}</div>
                    <div className="intel-bar-value">{c.n}</div>
                  </div>
                  <div className="intel-bar">
                    <div
                      className="intel-bar-fill"
                      style={{
                        width: `${players.length ? (c.n / players.length) * 100 : 0}%`,
                        background: SERIES,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {active && (
            <article className="intel-panel">
              <div className="intel-panel__header">
                <h3 className="intel-section-title">{active.player.name}</h3>
              </div>
              <div className="intel-metric-grid">
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Consistency</div>
                  <div className="intel-metric-card__value">{active.player.consistency}</div>
                </div>
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Explosiveness</div>
                  <div className="intel-metric-card__value">{active.player.explosiveness}</div>
                </div>
              </div>
              <p style={{ marginTop: ".75rem", fontSize: "12px", color: "#7a8fa8" }}>
                {active.player.position} · {CATEGORY_LABEL[active.player.category] || active.player.category}
                {active.player.tier ? ` · ${active.player.tier}` : ""}
              </p>
            </article>
          )}

          {Array.isArray(data?.insights) && data.insights.length > 0 && (
            <article className="intel-panel">
              <div className="intel-panel__header">
                <h3 className="intel-section-title">Insights</h3>
              </div>
              <div className="intel-stack">
                {data.insights.slice(0, 4).map((insight, i) => (
                  <div key={i} className="intel-insight-card">
                    {typeof insight === "string" ? insight : insight?.message || ""}
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}

window.Maps = Maps;

export default Maps;
