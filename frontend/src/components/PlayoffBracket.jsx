import React, { useState } from "react";

const LOGO = (abbr) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}`;

const BRACKET = {
  year: 2025,
  superBowl: {
    afc: { seed: 1, abbr: "KC",  name: "Chiefs",   record: "14-3", prob: 52 },
    nfc: { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 48 },
  },
  afc: {
    championship: {
      top:    { seed: 1, abbr: "KC",  name: "Chiefs",   record: "14-3", prob: 61 },
      bottom: { seed: 2, abbr: "BUF", name: "Bills",    record: "13-4", prob: 39 },
    },
    divisional: [
      { top: { seed: 1, abbr: "KC",  name: "Chiefs",   record: "14-3", prob: 68 },
        bottom: { seed: 5, abbr: "CIN", name: "Bengals",  record: "10-7", prob: 32 } },
      { top: { seed: 2, abbr: "BUF", name: "Bills",    record: "13-4", prob: 55 },
        bottom: { seed: 3, abbr: "BAL", name: "Ravens",   record: "12-5", prob: 45 } },
    ],
    wildCard: [
      { top: { seed: 2, abbr: "BUF", name: "Bills",    record: "13-4", prob: 78 },
        bottom: { seed: 7, abbr: "DEN", name: "Broncos",  record: "10-7", prob: 22 } },
      { top: { seed: 3, abbr: "BAL", name: "Ravens",   record: "12-5", prob: 65 },
        bottom: { seed: 6, abbr: "PIT", name: "Steelers", record: "10-7", prob: 35 } },
      { top: { seed: 4, abbr: "HOU", name: "Texans",   record: "11-6", prob: 57 },
        bottom: { seed: 5, abbr: "CIN", name: "Bengals",  record: "10-7", prob: 43 } },
    ],
  },
  nfc: {
    championship: {
      top:    { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 54 },
      bottom: { seed: 1, abbr: "DET", name: "Lions",    record: "15-2", prob: 46 },
    },
    divisional: [
      { top: { seed: 1, abbr: "DET", name: "Lions",    record: "15-2", prob: 66 },
        bottom: { seed: 4, abbr: "GB",  name: "Packers",  record: "11-6", prob: 34 } },
      { top: { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 60 },
        bottom: { seed: 3, abbr: "MIN", name: "Vikings",  record: "12-5", prob: 40 } },
    ],
    wildCard: [
      { top: { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 72 },
        bottom: { seed: 7, abbr: "WAS", name: "Commanders", record: "10-7", prob: 28 } },
      { top: { seed: 3, abbr: "MIN", name: "Vikings",  record: "12-5", prob: 59 },
        bottom: { seed: 6, abbr: "LAR", name: "Rams",     record: "10-7", prob: 41 } },
      { top: { seed: 4, abbr: "GB",  name: "Packers",  record: "11-6", prob: 54 },
        bottom: { seed: 5, abbr: "SEA", name: "Seahawks", record: "10-7", prob: 46 } },
    ],
  },
};

/* ── team row ─────────────────────────────────────────────────── */

function TeamRow({ team, winner }) {
  return (
    <div className={`pb-row${winner ? " pb-row--win" : ""}`}>
      {winner && <div className="pb-row__glow" />}
      <span className="pb-seed">{team.seed}</span>
      <img
        className="pb-logo"
        src={LOGO(team.abbr)}
        alt={team.abbr}
        onError={(e) => { e.target.style.display = "none"; }}
      />
      <span className="pb-abbr">{team.abbr}</span>
      <span className="pb-record">{team.record}</span>
      <span className={`pb-prob${winner ? " pb-prob--win" : ""}`}>
        {team.prob}<span className="pb-pct">%</span>
      </span>
      {winner && <span className="pb-arrow">▶</span>}
    </div>
  );
}

/* ── game card ────────────────────────────────────────────────── */

function GameCard({ game, size = "md", glowColor }) {
  const topWin    = game.top.prob    >= game.bottom.prob;
  const bottomWin = game.bottom.prob >  game.top.prob;
  const style     = glowColor ? { boxShadow: `0 0 24px ${glowColor}22, 0 2px 16px rgba(0,0,0,0.6)` } : {};

  return (
    <div className={`pb-card pb-card--${size}`} style={style}>
      <TeamRow team={game.top}    winner={topWin} />
      <div className="pb-sep" />
      <TeamRow team={game.bottom} winner={bottomWin} />
      <div className="pb-card-foot">
        <span className="pb-projected-badge">PROJECTED</span>
      </div>
    </div>
  );
}

/* ── SVG bracket connector ────────────────────────────────────── */

/*
  Draws L-shaped bracket lines connecting two vertically stacked game outputs
  to a single game input. Works by accepting percentage y-positions.

  positions: { top: 0..1, bottom: 0..1, mid: 0..1 } – as fraction of SVG height
  direction: 'right' (AFC, connector on right side of games → left of next round)
           | 'left'  (NFC, mirrored)
*/
function BracketArm({ gameCount = 2, direction = "right" }) {
  const W = 28;
  const H = "100%";
  const lineColor = "rgba(80,120,160,0.28)";
  const lw = 1.5;

  /* For 2 games → 1 game connector we use percentage y positions */
  if (gameCount === 2) {
    /* 2 div games → 1 conf game
       Div game centers: roughly 25% and 75% of column height
       Conf game center: 50% */
    if (direction === "right") {
      return (
        <svg width={W} height={H} preserveAspectRatio="none" style={{ flexShrink: 0, display: "block", alignSelf: "stretch" }}>
          <line x1={0} y1="25%" x2={W * 0.6} y2="25%" stroke={lineColor} strokeWidth={lw} />
          <line x1={W * 0.6} y1="25%" x2={W * 0.6} y2="75%" stroke={lineColor} strokeWidth={lw} />
          <line x1={0} y1="75%" x2={W * 0.6} y2="75%" stroke={lineColor} strokeWidth={lw} />
          <line x1={W * 0.6} y1="50%" x2={W} y2="50%" stroke={lineColor} strokeWidth={lw} />
        </svg>
      );
    }
    return (
      <svg width={W} height={H} preserveAspectRatio="none" style={{ flexShrink: 0, display: "block", alignSelf: "stretch" }}>
        <line x1={W} y1="25%" x2={W * 0.4} y2="25%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W * 0.4} y1="25%" x2={W * 0.4} y2="75%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W} y1="75%" x2={W * 0.4} y2="75%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W * 0.4} y1="50%" x2={0} y2="50%" stroke={lineColor} strokeWidth={lw} />
      </svg>
    );
  }

  /* For 3 WC games → 2 Div games:
     WC1 (top ~16.7%) + WC2 (mid ~50%) connect to Div2 (bottom ~75%)
     WC3 (bottom ~83.3%) connects to Div1 (top ~25%)
     We draw two separate L-brackets */
  if (gameCount === 3) {
    if (direction === "right") {
      return (
        <svg width={W} height={H} preserveAspectRatio="none" style={{ flexShrink: 0, display: "block", alignSelf: "stretch" }}>
          {/* WC1 + WC2 → Div game bottom (75%) */}
          <line x1={0} y1="16.7%" x2={W * 0.55} y2="16.7%" stroke={lineColor} strokeWidth={lw} />
          <line x1={W * 0.55} y1="16.7%" x2={W * 0.55} y2="50%" stroke={lineColor} strokeWidth={lw} />
          <line x1={0} y1="50%" x2={W * 0.55} y2="50%" stroke={lineColor} strokeWidth={lw} />
          <line x1={W * 0.55} y1="33.5%" x2={W} y2="33.5%" stroke={lineColor} strokeWidth={lw} />
          {/* WC3 → Div game top (25%) — but visually at 75% since Div game 1 is at top */}
          <line x1={0} y1="83.3%" x2={W * 0.55} y2="83.3%" stroke={lineColor} strokeWidth={lw} />
          <line x1={W * 0.55} y1="83.3%" x2={W * 0.55} y2="66.5%" stroke={lineColor} strokeWidth={lw} />
          <line x1={W * 0.55} y1="66.5%" x2={W} y2="66.5%" stroke={lineColor} strokeWidth={lw} />
        </svg>
      );
    }
    return (
      <svg width={W} height={H} preserveAspectRatio="none" style={{ flexShrink: 0, display: "block", alignSelf: "stretch" }}>
        <line x1={W} y1="16.7%" x2={W * 0.45} y2="16.7%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W * 0.45} y1="16.7%" x2={W * 0.45} y2="50%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W} y1="50%" x2={W * 0.45} y2="50%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W * 0.45} y1="33.5%" x2={0} y2="33.5%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W} y1="83.3%" x2={W * 0.45} y2="83.3%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W * 0.45} y1="83.3%" x2={W * 0.45} y2="66.5%" stroke={lineColor} strokeWidth={lw} />
        <line x1={W * 0.45} y1="66.5%" x2={0} y2="66.5%" stroke={lineColor} strokeWidth={lw} />
      </svg>
    );
  }

  return null;
}

/* ── Super Bowl center card ───────────────────────────────────── */

function SuperBowlCard({ game }) {
  const afcWin = game.afc.prob >= game.nfc.prob;
  return (
    <div className="pb-sb-card">
      <div className="pb-sb-header">
        <span className="pb-sb-trophy">🏆</span>
        <div>
          <div className="pb-sb-title">Super Bowl</div>
          <div className="pb-sb-sub">LIX · New Orleans</div>
        </div>
      </div>
      <div className="pb-sb-body">
        {/* AFC side */}
        <div className={`pb-sb-row${afcWin ? " pb-sb-row--win" : ""}`}>
          <span className="pb-sb-conf pb-sb-conf--afc">AFC</span>
          <span className="pb-seed pb-seed--sm">{game.afc.seed}</span>
          <img className="pb-logo pb-logo--lg" src={LOGO(game.afc.abbr)} alt={game.afc.abbr}
            onError={(e) => { e.target.style.display = "none"; }} />
          <span className="pb-sb-abbr">{game.afc.abbr}</span>
          <span className={`pb-sb-prob${afcWin ? " pb-sb-prob--win" : ""}`}>
            {game.afc.prob}<span className="pb-pct">%</span>
          </span>
          {afcWin && <span className="pb-arrow pb-arrow--lg">▶</span>}
        </div>
        <div className="pb-sb-vs">vs</div>
        {/* NFC side */}
        <div className={`pb-sb-row${!afcWin ? " pb-sb-row--win" : ""}`}>
          <span className="pb-sb-conf pb-sb-conf--nfc">NFC</span>
          <span className="pb-seed pb-seed--sm">{game.nfc.seed}</span>
          <img className="pb-logo pb-logo--lg" src={LOGO(game.nfc.abbr)} alt={game.nfc.abbr}
            onError={(e) => { e.target.style.display = "none"; }} />
          <span className="pb-sb-abbr">{game.nfc.abbr}</span>
          <span className={`pb-sb-prob${!afcWin ? " pb-sb-prob--win" : ""}`}>
            {game.nfc.prob}<span className="pb-pct">%</span>
          </span>
          {!afcWin && <span className="pb-arrow pb-arrow--lg">▶</span>}
        </div>
      </div>
      <div className="pb-sb-foot">AI PROJECTED</div>
    </div>
  );
}

/* ── Conference column ────────────────────────────────────────── */

function ConferenceColumn({ conf, side }) {
  const isAFC = side === "afc";

  /* Round: Wild Card */
  const wcCol = (
    <div className="pb-round">
      <div className="pb-round-label">Wild Card</div>
      <div className="pb-round-games pb-round-games--3">
        {conf.wildCard.map((g, i) => (
          <GameCard key={i} game={g} size="sm" />
        ))}
      </div>
    </div>
  );

  /* Round: Divisional */
  const divCol = (
    <div className="pb-round">
      <div className="pb-round-label">Divisional</div>
      <div className="pb-round-games pb-round-games--2">
        {conf.divisional.map((g, i) => (
          <GameCard key={i} game={g} size="sm" />
        ))}
      </div>
    </div>
  );

  /* Round: Conference Championship */
  const confCol = (
    <div className="pb-round">
      <div className="pb-round-label">Conf. Championship</div>
      <div className="pb-round-games pb-round-games--1">
        <GameCard game={conf.championship} size="md" />
      </div>
    </div>
  );

  /* connectors */
  const wc2div  = <BracketArm gameCount={3} direction={isAFC ? "right" : "left"} />;
  const div2conf = <BracketArm gameCount={2} direction={isAFC ? "right" : "left"} />;

  const inner = isAFC
    ? <>{wcCol}{wc2div}{divCol}{div2conf}{confCol}</>
    : <>{confCol}{div2conf}{divCol}{wc2div}{wcCol}</>;

  return (
    <div className="pb-conf-col">
      <div className={`pb-conf-badge pb-conf-badge--${side}`}>{side.toUpperCase()}</div>
      <div className="pb-rounds-row">
        {inner}
      </div>
    </div>
  );
}

/* ── Root ─────────────────────────────────────────────────────── */

export default function PlayoffBracket() {
  return (
    <div className="pb-root">
      <style>{`
        .pb-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: #e2e8f0;
          overflow-x: auto;
          padding: 0.25rem 0 1.5rem;
        }

        /* ── header ── */
        .pb-main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.75rem;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .pb-main-title {
          font-family: var(--font-display, 'Sora', sans-serif);
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -.025em;
          color: #f0f4fa;
        }
        .pb-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 999px;
          background: rgba(0,212,170,.1);
          color: #00d4aa;
          border: 1px solid rgba(0,212,170,.22);
        }

        /* ── bracket outer layout ── */
        .pb-layout {
          display: flex;
          align-items: stretch;
          gap: 0;
          min-width: 980px;
        }

        /* ── conference column ── */
        .pb-conf-col {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .pb-conf-badge {
          text-align: center;
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
          padding: 5px 0;
          border-radius: 6px;
          margin: 0 6px;
        }
        .pb-conf-badge--afc {
          background: rgba(0,52,148,.18);
          color: #7aaee0;
          border: 1px solid rgba(0,52,148,.3);
        }
        .pb-conf-badge--nfc {
          background: rgba(180,30,30,.15);
          color: #e07a7a;
          border: 1px solid rgba(180,30,30,.28);
        }
        .pb-rounds-row {
          display: flex;
          align-items: stretch;
          flex: 1;
          gap: 0;
        }

        /* ── round column ── */
        .pb-round {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0 5px;
          min-width: 0;
        }
        .pb-round-label {
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: .16em;
          text-transform: uppercase;
          color: rgba(255,255,255,.22);
          text-align: center;
          margin-bottom: 0.6rem;
          white-space: nowrap;
        }
        .pb-round-games {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .pb-round-games--3 { gap: 6px; justify-content: space-between; }
        .pb-round-games--2 { gap: 8px; justify-content: space-around; }
        .pb-round-games--1 { justify-content: center; }

        /* ── game card ── */
        .pb-card {
          background: linear-gradient(160deg, rgba(14,26,50,.98) 0%, rgba(8,16,34,.98) 100%);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 11px;
          overflow: hidden;
          position: relative;
          transition: border-color .18s, box-shadow .18s;
          flex-shrink: 0;
        }
        .pb-card:hover {
          border-color: rgba(96,165,250,.28);
          box-shadow: 0 4px 24px rgba(0,0,0,.45);
        }
        .pb-card--sm { min-width: 148px; }
        .pb-card--md { min-width: 158px; }

        /* ── team row ── */
        .pb-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          position: relative;
          overflow: hidden;
          transition: background .15s;
        }
        .pb-row--win {
          background: rgba(74,222,128,.05);
        }
        .pb-row--win::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2.5px;
          background: linear-gradient(180deg, #4ade80, #22c55e);
          border-radius: 0 2px 2px 0;
        }
        .pb-row__glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at left center, rgba(74,222,128,.07), transparent 60%);
          pointer-events: none;
        }
        .pb-seed {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: rgba(0,52,148,.45);
          color: #88aad4;
          font-size: 0.58rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: var(--font-mono, monospace);
        }
        .pb-seed--sm { width: 15px; height: 15px; font-size: 0.52rem; }
        .pb-logo {
          width: 24px;
          height: 24px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .pb-logo--lg { width: 30px; height: 30px; }
        .pb-abbr {
          font-size: 0.75rem;
          font-weight: 700;
          color: #9ab2cc;
          flex: 1;
          letter-spacing: .02em;
          min-width: 0;
        }
        .pb-row--win .pb-abbr { color: #d4e8f8; }
        .pb-record {
          font-size: 0.58rem;
          color: rgba(255,255,255,.22);
          font-family: var(--font-mono, monospace);
          letter-spacing: .03em;
          flex-shrink: 0;
        }
        .pb-prob {
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255,255,255,.55);
          flex-shrink: 0;
          min-width: 36px;
          text-align: right;
        }
        .pb-prob--win { color: #e2f0ff; }
        .pb-pct {
          font-size: 0.56rem;
          color: rgba(255,255,255,.3);
          margin-left: 1px;
        }
        .pb-arrow {
          font-size: 0.5rem;
          color: #4ade80;
          margin-left: 1px;
        }
        .pb-arrow--lg { font-size: 0.6rem; }
        .pb-sep {
          height: 1px;
          background: rgba(255,255,255,.06);
          margin: 0;
        }
        .pb-card-foot {
          padding: 3px 10px;
          background: rgba(0,0,0,.18);
          text-align: center;
        }
        .pb-projected-badge {
          font-size: 0.5rem;
          font-weight: 800;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: rgba(107,150,212,.5);
        }

        /* ── Super Bowl center card ── */
        .pb-sb-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 8px;
          flex-shrink: 0;
        }
        .pb-sb-connector {
          width: 18px;
          height: 2px;
          background: rgba(255,210,80,.2);
          flex-shrink: 0;
          margin: 0 2px;
        }
        .pb-sb-card {
          background: linear-gradient(160deg, #0c1a30 0%, #080f1e 100%);
          border: 1px solid rgba(255,210,80,.3);
          border-radius: 16px;
          overflow: hidden;
          min-width: 182px;
          box-shadow:
            0 0 0 1px rgba(255,210,80,.08),
            0 0 30px rgba(255,210,80,.08),
            0 12px 40px rgba(0,0,0,.6);
          animation: pb-sb-pulse 3s ease-in-out infinite;
        }
        @keyframes pb-sb-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,210,80,.08), 0 0 30px rgba(255,210,80,.08), 0 12px 40px rgba(0,0,0,.6); }
          50%       { box-shadow: 0 0 0 1px rgba(255,210,80,.18), 0 0 45px rgba(255,210,80,.16), 0 12px 40px rgba(0,0,0,.6); }
        }
        .pb-sb-header {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 10px 14px 8px;
          background: rgba(255,210,80,.07);
          border-bottom: 1px solid rgba(255,210,80,.14);
        }
        .pb-sb-trophy {
          font-size: 1.3rem;
          line-height: 1;
        }
        .pb-sb-title {
          font-family: var(--font-display, 'Sora', sans-serif);
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: .04em;
          color: #ffd250;
        }
        .pb-sb-sub {
          font-size: 0.58rem;
          font-weight: 600;
          letter-spacing: .1em;
          color: rgba(255,210,80,.45);
          margin-top: 1px;
        }
        .pb-sb-body { padding: 4px 0; }
        .pb-sb-row {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 14px;
          position: relative;
          overflow: hidden;
          transition: background .15s;
        }
        .pb-sb-row--win {
          background: rgba(255,210,80,.05);
        }
        .pb-sb-row--win::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, #ffd250, #f59e0b);
        }
        .pb-sb-vs {
          text-align: center;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: .1em;
          color: rgba(255,255,255,.18);
          padding: 2px 0;
          border-top: 1px solid rgba(255,255,255,.06);
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .pb-sb-conf {
          font-size: 0.52rem;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
          width: 28px;
          flex-shrink: 0;
        }
        .pb-sb-conf--afc { color: #6b96d4; }
        .pb-sb-conf--nfc { color: #e07a7a; }
        .pb-sb-abbr {
          font-size: 0.82rem;
          font-weight: 700;
          color: #9ab2cc;
          flex: 1;
          letter-spacing: .03em;
        }
        .pb-sb-row--win .pb-sb-abbr { color: #f0f4fa; }
        .pb-sb-prob {
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          font-weight: 700;
          color: rgba(255,255,255,.5);
        }
        .pb-sb-prob--win { color: #ffd250; }
        .pb-sb-foot {
          padding: 5px;
          text-align: center;
          font-size: 0.5rem;
          font-weight: 800;
          letter-spacing: .18em;
          color: rgba(255,210,80,.3);
          background: rgba(0,0,0,.2);
          border-top: 1px solid rgba(255,210,80,.1);
        }

        /* ── footnote ── */
        .pb-footnote {
          margin-top: 1.25rem;
          font-size: 0.7rem;
          color: rgba(255,255,255,.22);
          text-align: center;
          font-style: italic;
        }

        @media (max-width: 1024px) {
          .pb-layout { min-width: 880px; }
          .pb-card--sm { min-width: 130px; }
          .pb-card--md { min-width: 140px; }
          .pb-sb-card  { min-width: 162px; }
        }
      `}</style>

      <div className="pb-main-header">
        <div className="pb-main-title">{BRACKET.year} NFL Playoff Bracket</div>
        <span className="pb-ai-badge">⚡ AI Projected</span>
      </div>

      <div className="pb-layout">
        {/* AFC side */}
        <ConferenceColumn conf={BRACKET.afc} side="afc" />

        {/* Super Bowl center */}
        <div className="pb-sb-col">
          <div className="pb-sb-connector" />
          <SuperBowlCard game={BRACKET.superBowl} />
          <div className="pb-sb-connector" />
        </div>

        {/* NFC side */}
        <ConferenceColumn conf={BRACKET.nfc} side="nfc" />
      </div>

      <p className="pb-footnote">
        Win probabilities are Monte Carlo model outputs — not a guarantee of results.
      </p>
    </div>
  );
}
