import React from "react";
import { api } from "../api";

const LOGO = (abbr) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}`;

/* ─── offline fallback ────────────────────────────────────────────────────── */
/* Used only when the live bracket endpoint is unavailable.
   Divisional slot 0 = WC winners matchup (connects from top 2 WC games)
   Divisional slot 1 = 1-seed bye vs WC3 winner (connects from bottom WC game) */
const FALLBACK_BRACKET = {
  year: 2026,
  superBowl: {
    afc: { seed: 1, abbr: "KC",  name: "Chiefs",   prob: 52 },
    nfc: { seed: 2, abbr: "PHI", name: "Eagles",   prob: 48 },
  },
  afc: {
    championship: {
      top:    { seed: 1, abbr: "KC",  name: "Chiefs",   prob: 61 },
      bottom: { seed: 2, abbr: "BUF", name: "Bills",    prob: 39 },
    },
    divisional: [
      /* slot 0 — top — WC1 winner vs WC2 winner */
      { top: { seed: 2, abbr: "BUF", name: "Bills",    prob: 55 },
        bottom: { seed: 3, abbr: "BAL", name: "Ravens",   prob: 45 } },
      /* slot 1 — bottom — 1 seed vs WC3 winner */
      { top: { seed: 1, abbr: "KC",  name: "Chiefs",   prob: 68 },
        bottom: { seed: 5, abbr: "CIN", name: "Bengals",  prob: 32 } },
    ],
    wildCard: [
      { top: { seed: 2, abbr: "BUF", name: "Bills",    prob: 78 },
        bottom: { seed: 7, abbr: "DEN", name: "Broncos",  prob: 22 } },
      { top: { seed: 3, abbr: "BAL", name: "Ravens",   prob: 65 },
        bottom: { seed: 6, abbr: "PIT", name: "Steelers", prob: 35 } },
      { top: { seed: 4, abbr: "HOU", name: "Texans",   prob: 57 },
        bottom: { seed: 5, abbr: "CIN", name: "Bengals",  prob: 43 } },
    ],
  },
  nfc: {
    championship: {
      top:    { seed: 2, abbr: "PHI", name: "Eagles",   prob: 54 },
      bottom: { seed: 1, abbr: "DET", name: "Lions",    prob: 46 },
    },
    divisional: [
      /* slot 0 — top — WC1 winner vs WC2 winner */
      { top: { seed: 2, abbr: "PHI", name: "Eagles",   prob: 60 },
        bottom: { seed: 3, abbr: "MIN", name: "Vikings",  prob: 40 } },
      /* slot 1 — bottom — 1 seed vs WC3 winner */
      { top: { seed: 1, abbr: "DET", name: "Lions",    prob: 66 },
        bottom: { seed: 4, abbr: "GB",  name: "Packers",  prob: 34 } },
    ],
    wildCard: [
      { top: { seed: 2, abbr: "PHI", name: "Eagles",   prob: 72 },
        bottom: { seed: 7, abbr: "WAS", name: "Commanders", prob: 28 } },
      { top: { seed: 3, abbr: "MIN", name: "Vikings",  prob: 59 },
        bottom: { seed: 6, abbr: "LAR", name: "Rams",     prob: 41 } },
      { top: { seed: 4, abbr: "GB",  name: "Packers",  prob: 54 },
        bottom: { seed: 5, abbr: "SEA", name: "Seahawks", prob: 46 } },
    ],
  },
};

/* ─── helpers ─────────────────────────────────────────────────────────────── */

function TeamRow({ team, winner }) {
  return (
    <div className={`pbr-row${winner ? " pbr-row--w" : ""}`}>
      {winner && <div className="pbr-row-glow" />}
      <span className="pbr-seed">{team.seed}</span>
      <img
        className="pbr-logo"
        src={LOGO(team.abbr)}
        alt={team.abbr}
        onError={(e) => { e.target.style.display = "none"; }}
      />
      <span className="pbr-abbr">{team.abbr}</span>
      <span className={`pbr-prob${winner ? " pbr-prob--w" : ""}`}>
        {team.prob}<span className="pbr-pct">%</span>
      </span>
      {winner && <span className="pbr-arrow">▶</span>}
    </div>
  );
}

function Card({ game, size = "sm" }) {
  const topW = game.top.prob >= game.bottom.prob;
  return (
    <div className={`pbr-card pbr-card--${size}`}>
      <TeamRow team={game.top}    winner={topW} />
      <div className="pbr-sep" />
      <TeamRow team={game.bottom} winner={!topW} />
      <div className="pbr-foot">PROJECTED</div>
    </div>
  );
}

/* ─── connector SVG ───────────────────────────────────────────────────────── */
/*
  WC (3 games) → Div (2 games):
    top 2 WC games  connect to Div slot 0 (top half)
    bottom WC game  connects to Div slot 1 (bottom half)

  As percentage of column height:
    WC centers:  16.7%, 50%, 83.3%
    Div centers: 25%,  75%

  We draw two separate bracket groups so lines never cross.
*/
const LC = "rgba(70,110,155,0.32)"; // line color
const LW = 1.5;                      // line width

function ConnArm3to2({ dir }) {
  /* dir: "r" = AFC (output to right), "l" = NFC (output to left) */
  const W = 22;
  const r = dir === "r";
  const sx = r ? 0 : W;   // start x (comes from game)
  const ex = r ? W : 0;   // end x   (goes to next round)
  const spine = r ? W * 0.55 : W * 0.45;

  return (
    <svg width={W} style={{ alignSelf: "stretch", flexShrink: 0, display: "block" }}
      height="100%" preserveAspectRatio="none">
      {/* Group 1: WC1 (16.7%) + WC2 (50%) → Div top (25%) */}
      <line x1={sx} y1="16.7%" x2={spine} y2="16.7%" stroke={LC} strokeWidth={LW} />
      <line x1={sx} y1="50%"   x2={spine} y2="50%"   stroke={LC} strokeWidth={LW} />
      <line x1={spine} y1="16.7%" x2={spine} y2="50%"   stroke={LC} strokeWidth={LW} />
      <line x1={spine} y1="33.4%" x2={ex}    y2="33.4%" stroke={LC} strokeWidth={LW} />
      {/* Group 2: WC3 (83.3%) → Div bottom (75%) */}
      <line x1={sx}    y1="83.3%" x2={spine} y2="83.3%" stroke={LC} strokeWidth={LW} />
      <line x1={spine} y1="83.3%" x2={spine} y2="75%"   stroke={LC} strokeWidth={LW} />
      <line x1={spine} y1="75%"   x2={ex}    y2="75%"   stroke={LC} strokeWidth={LW} />
    </svg>
  );
}

function ConnArm2to1({ dir }) {
  const W = 22;
  const r = dir === "r";
  const sx = r ? 0 : W;
  const ex = r ? W : 0;
  const spine = r ? W * 0.55 : W * 0.45;

  return (
    <svg width={W} style={{ alignSelf: "stretch", flexShrink: 0, display: "block" }}
      height="100%" preserveAspectRatio="none">
      {/* Div top (25%) + Div bottom (75%) → Conf center (50%) */}
      <line x1={sx} y1="25%" x2={spine} y2="25%" stroke={LC} strokeWidth={LW} />
      <line x1={sx} y1="75%" x2={spine} y2="75%" stroke={LC} strokeWidth={LW} />
      <line x1={spine} y1="25%" x2={spine} y2="75%"  stroke={LC} strokeWidth={LW} />
      <line x1={spine} y1="50%" x2={ex}    y2="50%"  stroke={LC} strokeWidth={LW} />
    </svg>
  );
}

/* Horizontal stub from Conf → SB */
function SbStub() {
  return (
    <svg width={20} height="100%" style={{ flexShrink: 0, display: "block", alignSelf: "stretch" }}
      preserveAspectRatio="none">
      <line x1={0} y1="50%" x2={20} y2="50%" stroke={LC} strokeWidth={LW} />
    </svg>
  );
}

/* ─── Super Bowl center ───────────────────────────────────────────────────── */

function SuperBowl({ game }) {
  const afcW = game.afc.prob >= game.nfc.prob;
  return (
    <div className="pbr-sb">
      <div className="pbr-sb-head">
        <span className="pbr-sb-trophy">🏆</span>
        <div>
          <div className="pbr-sb-title">Super Bowl</div>
          <div className="pbr-sb-venue">LIX · New Orleans</div>
        </div>
      </div>

      <div className={`pbr-sb-row${afcW ? " pbr-sb-row--w" : ""}`}>
        <span className="pbr-sb-conf pbr-sb-conf--afc">AFC</span>
        <span className="pbr-seed pbr-seed--sb">{game.afc.seed}</span>
        <img className="pbr-logo pbr-logo--sb" src={LOGO(game.afc.abbr)} alt={game.afc.abbr}
          onError={(e) => { e.target.style.display = "none"; }} />
        <span className="pbr-sb-abbr">{game.afc.abbr}</span>
        <span className={`pbr-prob${afcW ? " pbr-prob--w" : ""}`}>
          {game.afc.prob}<span className="pbr-pct">%</span>
        </span>
        {afcW && <span className="pbr-arrow">▶</span>}
      </div>

      <div className="pbr-sb-vs">vs</div>

      <div className={`pbr-sb-row${!afcW ? " pbr-sb-row--w" : ""}`}>
        <span className="pbr-sb-conf pbr-sb-conf--nfc">NFC</span>
        <span className="pbr-seed pbr-seed--sb">{game.nfc.seed}</span>
        <img className="pbr-logo pbr-logo--sb" src={LOGO(game.nfc.abbr)} alt={game.nfc.abbr}
          onError={(e) => { e.target.style.display = "none"; }} />
        <span className="pbr-sb-abbr">{game.nfc.abbr}</span>
        <span className={`pbr-prob${!afcW ? " pbr-prob--w" : ""}`}>
          {game.nfc.prob}<span className="pbr-pct">%</span>
        </span>
        {!afcW && <span className="pbr-arrow">▶</span>}
      </div>

      <div className="pbr-sb-foot">AI PROJECTED</div>
    </div>
  );
}

/* ─── Conference half ─────────────────────────────────────────────────────── */

function ConfHalf({ conf, side }) {
  const isAfc = side === "afc";

  const wcRound = (
    <div className="pbr-round pbr-round--wc">
      <div className="pbr-round-lbl">Wild Card</div>
      <div className="pbr-games pbr-games--3">
        {conf.wildCard.map((g, i) => <Card key={i} game={g} size="sm" />)}
      </div>
    </div>
  );

  const divRound = (
    <div className="pbr-round pbr-round--div">
      <div className="pbr-round-lbl">Divisional</div>
      <div className="pbr-games pbr-games--2">
        {conf.divisional.map((g, i) => <Card key={i} game={g} size="sm" />)}
      </div>
    </div>
  );

  const confRound = (
    <div className="pbr-round pbr-round--conf">
      <div className="pbr-round-lbl">Conf. Champ</div>
      <div className="pbr-games pbr-games--1">
        <Card game={conf.championship} size="sm" />
      </div>
    </div>
  );

  return (
    <div className="pbr-half">
      <div className={`pbr-conf-chip pbr-conf-chip--${side}`}>{side.toUpperCase()}</div>
      <div className="pbr-rounds">
        {isAfc
          ? <>{wcRound}<ConnArm3to2 dir="r" />{divRound}<ConnArm2to1 dir="r" />{confRound}<SbStub /></>
          : <><SbStub />{confRound}<ConnArm2to1 dir="l" />{divRound}<ConnArm3to2 dir="l" />{wcRound}</>
        }
      </div>
    </div>
  );
}

/* ─── Root ────────────────────────────────────────────────────────────────── */

const CURRENT_SEASON = (() => {
  const now = new Date();
  /* NFL season is labeled by the year it starts; the playoffs run into the
     following calendar year, so Jan–Feb still belong to the prior season. */
  return now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear();
})();

/* "2026" -> "2026–27 NFL Playoff Bracket" */
function seasonTitle(startYear) {
  const y = Number(startYear) || CURRENT_SEASON;
  const endYY = String((y + 1) % 100).padStart(2, "0");
  return `${y}–${endYY} NFL Playoff Bracket`;
}

export default function PlayoffBracket() {
  const [bracket, setBracket] = React.useState(FALLBACK_BRACKET);
  const [source, setSource]   = React.useState("loading"); // loading | live | fallback

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!api?.getPlayoffBracket) throw new Error("API unavailable");
        const json = await api.getPlayoffBracket(CURRENT_SEASON);
        if (cancelled) return;
        if (json?.success && json.afc && json.nfc && json.superBowl) {
          setBracket({ year: json.year, superBowl: json.superBowl, afc: json.afc, nfc: json.nfc });
          setSource("live");
        } else {
          setSource("fallback");
        }
      } catch {
        if (!cancelled) setSource("fallback");
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="pbr-root">
      <style>{`
        /* ── reset & root ── */
        .pbr-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: #dce8f4;
          overflow-x: auto;
          padding-bottom: 1.5rem;
          -webkit-overflow-scrolling: touch;
        }

        /* ── page header ── */
        .pbr-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .pbr-title {
          font-family: var(--font-display, 'Sora', sans-serif);
          font-size: 1.45rem;
          font-weight: 700;
          letter-spacing: -.025em;
          color: #f0f6ff;
        }
        /* ── bracket frame ── */
        .pbr-frame {
          display: flex;
          align-items: stretch;
          min-width: 940px;
          gap: 0;
        }

        /* ── conference half ── */
        .pbr-half {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .pbr-conf-chip {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 6px;
          text-align: center;
          align-self: flex-start;
          margin-left: 4px;
        }
        .pbr-conf-chip--afc {
          background: rgba(0,52,148,.22);
          color: #6fa4e0;
          border: 1px solid rgba(0,52,148,.35);
        }
        .pbr-conf-chip--nfc {
          background: rgba(170,30,30,.18);
          color: #e07a7a;
          border: 1px solid rgba(170,30,30,.3);
          align-self: flex-end;
          margin-left: 0;
          margin-right: 4px;
        }
        .pbr-rounds {
          display: flex;
          align-items: stretch;
          flex: 1;
          gap: 0;
        }

        /* ── round ── */
        .pbr-round {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
          padding: 0 4px;
        }
        .pbr-round-lbl {
          font-size: 0.52rem;
          font-weight: 700;
          letter-spacing: .15em;
          text-transform: uppercase;
          color: rgba(255,255,255,.2);
          text-align: center;
          margin-bottom: 0.5rem;
          white-space: nowrap;
        }
        .pbr-games {
          display: flex;
          flex-direction: column;
          flex: 1;
          gap: 6px;
        }
        .pbr-games--3 { justify-content: space-between; }
        .pbr-games--2 { justify-content: space-around; }
        .pbr-games--1 { justify-content: center; }

        /* ── game card ── */
        .pbr-card {
          background: linear-gradient(155deg, rgba(14,26,52,.98) 0%, rgba(7,14,30,.98) 100%);
          border: 1px solid rgba(255,255,255,.085);
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          transition: border-color .18s, box-shadow .18s;
        }
        .pbr-card:hover {
          border-color: rgba(100,160,230,.3);
          box-shadow: 0 4px 20px rgba(0,0,0,.45);
        }
        .pbr-card--sm { min-width: 114px; }

        /* ── team row ── */
        .pbr-row {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 9px;
          position: relative;
          overflow: hidden;
        }
        .pbr-row--w { background: rgba(74,222,128,.055); }
        .pbr-row--w::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 2.5px;
          background: linear-gradient(180deg, #4ade80, #16a34a);
          border-radius: 0 2px 2px 0;
        }
        .pbr-row-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at left center, rgba(74,222,128,.07), transparent 55%);
          pointer-events: none;
        }
        .pbr-seed {
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: rgba(0,40,120,.45);
          color: #7090c0;
          font-size: 0.54rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-family: var(--font-mono, monospace);
        }
        .pbr-seed--sb { width: 16px; height: 16px; font-size: 0.56rem; }
        .pbr-logo {
          width: 22px;
          height: 22px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .pbr-logo--sb { width: 27px; height: 27px; }
        .pbr-abbr {
          font-size: 0.72rem;
          font-weight: 700;
          color: #8aacc8;
          flex: 1;
          min-width: 0;
          letter-spacing: .02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pbr-row--w .pbr-abbr { color: #d8eeff; }
        .pbr-prob {
          font-family: var(--font-mono, monospace);
          font-size: 0.76rem;
          font-weight: 700;
          color: rgba(255,255,255,.42);
          flex-shrink: 0;
        }
        .pbr-prob--w { color: #e8f4ff; }
        .pbr-pct { font-size: 0.54rem; color: rgba(255,255,255,.28); margin-left: 1px; }
        .pbr-arrow { font-size: 0.48rem; color: #4ade80; margin-left: 2px; }
        .pbr-sep { height: 1px; background: rgba(255,255,255,.055); }
        .pbr-foot {
          padding: 2px 8px;
          text-align: center;
          font-size: 0.45rem;
          font-weight: 800;
          letter-spacing: .16em;
          color: rgba(100,140,200,.38);
          background: rgba(0,0,0,.18);
        }

        /* ── Super Bowl ── */
        .pbr-sb-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          padding-top: 1.25rem; /* offset for round labels */
        }
        .pbr-sb {
          background: linear-gradient(155deg, #0c1b32 0%, #070e1c 100%);
          border: 1px solid rgba(255,205,70,.28);
          border-radius: 14px;
          overflow: hidden;
          min-width: 158px;
          box-shadow:
            0 0 0 1px rgba(255,205,70,.06),
            0 0 28px rgba(255,205,70,.07),
            0 10px 36px rgba(0,0,0,.65);
          animation: pbr-pulse 3.2s ease-in-out infinite;
        }
        @keyframes pbr-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,205,70,.06), 0 0 28px rgba(255,205,70,.07), 0 10px 36px rgba(0,0,0,.65); }
          50%       { box-shadow: 0 0 0 1px rgba(255,205,70,.14), 0 0 42px rgba(255,205,70,.14), 0 10px 36px rgba(0,0,0,.65); }
        }
        .pbr-sb-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px 7px;
          background: rgba(255,205,70,.065);
          border-bottom: 1px solid rgba(255,205,70,.13);
        }
        .pbr-sb-trophy { font-size: 1.2rem; line-height: 1; }
        .pbr-sb-title {
          font-family: var(--font-display, 'Sora', sans-serif);
          font-size: 0.82rem;
          font-weight: 700;
          color: #ffd050;
          letter-spacing: .02em;
        }
        .pbr-sb-venue {
          font-size: 0.55rem;
          font-weight: 600;
          letter-spacing: .08em;
          color: rgba(255,205,70,.42);
          margin-top: 1px;
        }
        .pbr-sb-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          position: relative;
          overflow: hidden;
        }
        .pbr-sb-row--w { background: rgba(255,205,70,.05); }
        .pbr-sb-row--w::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 2.5px;
          background: linear-gradient(180deg, #ffd050, #f59e0b);
        }
        .pbr-sb-vs {
          text-align: center;
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: .1em;
          color: rgba(255,255,255,.16);
          padding: 2px 0;
          border-top: 1px solid rgba(255,255,255,.055);
          border-bottom: 1px solid rgba(255,255,255,.055);
        }
        .pbr-sb-conf {
          font-size: 0.5rem;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
          width: 26px;
          flex-shrink: 0;
        }
        .pbr-sb-conf--afc { color: #6fa4e0; }
        .pbr-sb-conf--nfc { color: #e07a7a; }
        .pbr-sb-abbr {
          font-size: 0.78rem;
          font-weight: 700;
          color: #8aacc8;
          flex: 1;
        }
        .pbr-sb-row--w .pbr-sb-abbr { color: #f0f6ff; }
        .pbr-sb-foot {
          padding: 4px;
          text-align: center;
          font-size: 0.46rem;
          font-weight: 800;
          letter-spacing: .18em;
          color: rgba(255,205,70,.28);
          background: rgba(0,0,0,.2);
          border-top: 1px solid rgba(255,205,70,.1);
        }

        /* ── footnote ── */
        .pbr-note {
          margin-top: 1rem;
          font-size: 0.68rem;
          color: rgba(255,255,255,.2);
          text-align: center;
          font-style: italic;
        }
      `}</style>

      <div className="pbr-header">
        <div className="pbr-title">{seasonTitle(bracket.year)}</div>
      </div>

      <div className="pbr-frame">
        <ConfHalf conf={bracket.afc} side="afc" />

        <div className="pbr-sb-col">
          <SuperBowl game={bracket.superBowl} />
        </div>

        <ConfHalf conf={bracket.nfc} side="nfc" />
      </div>

      <p className="pbr-note">
        {source === "live"
          ? `Projected from live ${bracket.year} season data — win probabilities are model outputs, not a guarantee of results.`
          : "Win probabilities are model outputs — not a guarantee of results."}
      </p>
    </div>
  );
}
