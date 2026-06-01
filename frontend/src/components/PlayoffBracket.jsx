import React, { useState } from "react";

const LOGO = (abbr) =>
  `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}`;

// Projected 2025-26 NFL Playoffs — win probability mode
const BRACKET = {
  label: "2025 NFL Playoff Bracket",
  mode: "projected",
  superBowl: {
    afc: { seed: 1, abbr: "KC",  name: "Chiefs",   record: "14-3", prob: 52 },
    nfc: { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 48 },
    status: "PROJECTED",
  },
  afc: {
    championship: {
      top:    { seed: 1, abbr: "KC",  name: "Chiefs",   record: "14-3", prob: 61 },
      bottom: { seed: 2, abbr: "BUF", name: "Bills",    record: "13-4", prob: 39 },
      status: "PROJECTED",
    },
    divisional: [
      {
        top:    { seed: 1, abbr: "KC",  name: "Chiefs",   record: "14-3", prob: 68 },
        bottom: { seed: 5, abbr: "CIN", name: "Bengals",  record: "10-7", prob: 32 },
        status: "PROJECTED",
      },
      {
        top:    { seed: 2, abbr: "BUF", name: "Bills",    record: "13-4", prob: 55 },
        bottom: { seed: 3, abbr: "BAL", name: "Ravens",   record: "12-5", prob: 45 },
        status: "PROJECTED",
      },
    ],
    wildCard: [
      {
        top:    { seed: 2, abbr: "BUF", name: "Bills",    record: "13-4", prob: 78 },
        bottom: { seed: 7, abbr: "DEN", name: "Broncos",  record: "10-7", prob: 22 },
        status: "PROJECTED",
      },
      {
        top:    { seed: 3, abbr: "BAL", name: "Ravens",   record: "12-5", prob: 65 },
        bottom: { seed: 6, abbr: "PIT", name: "Steelers", record: "10-7", prob: 35 },
        status: "PROJECTED",
      },
      {
        top:    { seed: 4, abbr: "HOU", name: "Texans",   record: "11-6", prob: 57 },
        bottom: { seed: 5, abbr: "CIN", name: "Bengals",  record: "10-7", prob: 43 },
        status: "PROJECTED",
      },
    ],
  },
  nfc: {
    championship: {
      top:    { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 54 },
      bottom: { seed: 1, abbr: "DET", name: "Lions",    record: "15-2", prob: 46 },
      status: "PROJECTED",
    },
    divisional: [
      {
        top:    { seed: 1, abbr: "DET", name: "Lions",    record: "15-2", prob: 66 },
        bottom: { seed: 4, abbr: "GB",  name: "Packers",  record: "11-6", prob: 34 },
        status: "PROJECTED",
      },
      {
        top:    { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 60 },
        bottom: { seed: 3, abbr: "MIN", name: "Vikings",  record: "12-5", prob: 40 },
        status: "PROJECTED",
      },
    ],
    wildCard: [
      {
        top:    { seed: 2, abbr: "PHI", name: "Eagles",   record: "13-4", prob: 72 },
        bottom: { seed: 7, abbr: "WAS", name: "Commanders",record:"10-7", prob: 28 },
        status: "PROJECTED",
      },
      {
        top:    { seed: 3, abbr: "MIN", name: "Vikings",  record: "12-5", prob: 59 },
        bottom: { seed: 6, abbr: "LAR", name: "Rams",     record: "10-7", prob: 41 },
        status: "PROJECTED",
      },
      {
        top:    { seed: 4, abbr: "GB",  name: "Packers",  record: "11-6", prob: 54 },
        bottom: { seed: 5, abbr: "SEA", name: "Seahawks", record: "10-7", prob: 46 },
        status: "PROJECTED",
      },
    ],
  },
};

function TeamRow({ team, isWinner, mode }) {
  return (
    <div className={`pb-team-row${isWinner ? " pb-team-row--winner" : ""}`}>
      <span className="pb-seed">{team.seed}</span>
      <img
        className="pb-logo"
        src={LOGO(team.abbr)}
        alt={team.name}
        onError={(e) => { e.target.style.display = "none"; }}
      />
      <span className="pb-abbr">{team.abbr}</span>
      <span className="pb-score">
        {mode === "projected"
          ? <span className="pb-prob">{team.prob}<span className="pb-pct">%</span></span>
          : <span className="pb-pts">{team.pts ?? "—"}</span>
        }
      </span>
      {isWinner && <span className="pb-arrow">▶</span>}
    </div>
  );
}

function GameCard({ game, mode, size = "md" }) {
  const [topWin, bottomWin] = game.status === "FINAL" || game.status === "PROJECTED"
    ? [game.top.prob > game.bottom.prob, game.bottom.prob > game.top.prob]
    : [false, false];

  return (
    <div className={`pb-game pb-game--${size}`}>
      <TeamRow team={game.top}    isWinner={topWin}    mode={mode} />
      <div className="pb-divider" />
      <TeamRow team={game.bottom} isWinner={bottomWin} mode={mode} />
      <div className="pb-game-footer">
        <span className={`pb-status pb-status--${game.status === "FINAL" ? "final" : "projected"}`}>
          {game.status}
        </span>
      </div>
    </div>
  );
}

function SuperBowlCard({ game, mode }) {
  const afcWin = game.afc.prob > game.nfc.prob;
  return (
    <div className="pb-superbowl-card">
      <div className="pb-sb-label">
        <span className="pb-sb-icon">🏆</span>
        Super Bowl
      </div>
      <div className={`pb-team-row pb-team-row--sb${afcWin ? " pb-team-row--winner" : ""}`}>
        <span className="pb-sb-conf">AFC</span>
        <span className="pb-seed">{game.afc.seed}</span>
        <img className="pb-logo" src={LOGO(game.afc.abbr)} alt={game.afc.name}
          onError={(e) => { e.target.style.display = "none"; }} />
        <span className="pb-abbr">{game.afc.abbr}</span>
        <span className="pb-prob">{game.afc.prob}<span className="pb-pct">%</span></span>
        {afcWin && <span className="pb-arrow">▶</span>}
      </div>
      <div className="pb-divider" />
      <div className={`pb-team-row pb-team-row--sb${!afcWin ? " pb-team-row--winner" : ""}`}>
        <span className="pb-sb-conf">NFC</span>
        <span className="pb-seed">{game.nfc.seed}</span>
        <img className="pb-logo" src={LOGO(game.nfc.abbr)} alt={game.nfc.name}
          onError={(e) => { e.target.style.display = "none"; }} />
        <span className="pb-abbr">{game.nfc.abbr}</span>
        <span className="pb-prob">{game.nfc.prob}<span className="pb-pct">%</span></span>
        {!afcWin && <span className="pb-arrow">▶</span>}
      </div>
      <div className="pb-game-footer">
        <span className="pb-status pb-status--projected">{game.status}</span>
      </div>
    </div>
  );
}

function ConferenceColumn({ conf, side, mode }) {
  return (
    <div className={`pb-conf-col pb-conf-col--${side}`}>
      <div className="pb-conf-header">
        <span className="pb-conf-badge">{side.toUpperCase()}</span>
      </div>
      <div className="pb-rounds-wrap">
        {/* Wild Card column */}
        <div className="pb-round pb-round--wc">
          <div className="pb-round-label">Wild Card</div>
          <div className="pb-round-games">
            {conf.wildCard.map((g, i) => (
              <div key={i} className="pb-game-slot">
                <GameCard game={g} mode={mode} />
                <div className="pb-connector pb-connector--out" />
              </div>
            ))}
          </div>
        </div>

        {/* Divisional column */}
        <div className="pb-round pb-round--div">
          <div className="pb-round-label">Divisional</div>
          <div className="pb-round-games">
            {conf.divisional.map((g, i) => (
              <div key={i} className="pb-game-slot">
                <div className="pb-connector pb-connector--in" />
                <GameCard game={g} mode={mode} />
                <div className="pb-connector pb-connector--out" />
              </div>
            ))}
          </div>
        </div>

        {/* Conference Championship column */}
        <div className="pb-round pb-round--conf">
          <div className="pb-round-label">Conf. Championship</div>
          <div className="pb-round-games">
            <div className="pb-game-slot">
              <div className="pb-connector pb-connector--in" />
              <GameCard game={conf.championship} mode={mode} />
              <div className="pb-connector pb-connector--out" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayoffBracket() {
  const [mode] = useState("projected");

  return (
    <div className="pb-root">
      <style>{`
        .pb-root {
          font-family: var(--font-ui, 'Manrope', system-ui, sans-serif);
          color: var(--fg, #e2e8f0);
          padding: 1.5rem 0;
          overflow-x: auto;
        }

        .pb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .pb-title {
          font-family: var(--font-display, 'Sora', sans-serif);
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: -.02em;
          color: var(--fg, #e2e8f0);
        }

        .pb-mode-badge {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(0,212,170,.15);
          color: #00d4aa;
          border: 1px solid rgba(0,212,170,.25);
        }

        .pb-bracket {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          min-width: 900px;
        }

        .pb-conf-col {
          flex: 1;
          min-width: 0;
        }

        .pb-conf-header {
          text-align: center;
          margin-bottom: 1rem;
        }

        .pb-conf-badge {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: .2em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 999px;
          background: rgba(0, 52, 148, 0.2);
          color: #6b96d4;
          border: 1px solid rgba(0, 52, 148, 0.35);
        }

        .pb-rounds-wrap {
          display: flex;
          align-items: stretch;
          gap: 0;
        }

        .pb-conf-col--afc .pb-rounds-wrap {
          flex-direction: row;
        }

        .pb-conf-col--nfc .pb-rounds-wrap {
          flex-direction: row-reverse;
        }

        .pb-round {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 0 6px;
        }

        .pb-round-label {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--fg-faint, #4a6080);
          text-align: center;
          margin-bottom: 0.5rem;
          white-space: nowrap;
        }

        .pb-round-games {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          flex: 1;
          gap: 8px;
        }

        .pb-round--wc .pb-round-games {
          gap: 8px;
        }

        .pb-round--div .pb-round-games {
          gap: 24px;
        }

        .pb-round--conf .pb-round-games {
          justify-content: center;
        }

        .pb-game-slot {
          display: flex;
          align-items: center;
          gap: 0;
        }

        .pb-conf-col--nfc .pb-game-slot {
          flex-direction: row-reverse;
        }

        .pb-connector {
          width: 16px;
          height: 2px;
          background: rgba(100, 130, 160, 0.3);
          flex-shrink: 0;
        }

        .pb-game {
          background: var(--card-bg, rgba(10, 22, 40, 0.95));
          border: 1px solid var(--border-soft, rgba(255,255,255,0.08));
          border-radius: 10px;
          overflow: hidden;
          min-width: 140px;
          flex-shrink: 0;
          transition: border-color .2s, box-shadow .2s;
        }

        .pb-game:hover {
          border-color: rgba(100,160,220,0.35);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .pb-game--md {
          min-width: 148px;
        }

        .pb-team-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          position: relative;
          transition: background .15s;
        }

        .pb-team-row--winner {
          background: rgba(0, 212, 170, 0.07);
        }

        .pb-team-row--winner .pb-abbr {
          color: #e2e8f0;
          font-weight: 700;
        }

        .pb-seed {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(0, 52, 148, 0.4);
          color: #88aad4;
          font-size: 0.6rem;
          font-weight: 800;
          flex-shrink: 0;
          font-family: var(--font-mono, monospace);
        }

        .pb-logo {
          width: 22px;
          height: 22px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .pb-abbr {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--fg-soft, #8aa0bc);
          flex: 1;
          min-width: 0;
          letter-spacing: .02em;
        }

        .pb-score {
          margin-left: auto;
        }

        .pb-prob {
          font-family: var(--font-mono, monospace);
          font-size: 0.82rem;
          font-weight: 700;
          color: #e2e8f0;
        }

        .pb-pct {
          font-size: 0.6rem;
          color: var(--fg-faint, #4a6080);
          margin-left: 1px;
        }

        .pb-pts {
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          font-weight: 800;
          color: #e2e8f0;
        }

        .pb-arrow {
          font-size: 0.55rem;
          color: #00d4aa;
          margin-left: 3px;
        }

        .pb-divider {
          height: 1px;
          background: var(--border-soft, rgba(255,255,255,0.07));
          margin: 0;
        }

        .pb-game-footer {
          padding: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: rgba(0,0,0,0.15);
        }

        .pb-status {
          font-size: 0.55rem;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .pb-status--final    { color: #78e5bf; }
        .pb-status--projected { color: #6b96d4; }

        .pb-sb-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          flex-shrink: 0;
        }

        .pb-sb-connector-afc,
        .pb-sb-connector-nfc {
          width: 20px;
          height: 2px;
          background: rgba(100, 130, 160, 0.3);
        }

        .pb-superbowl-card {
          background: linear-gradient(160deg, #0a1a2e, #061020);
          border: 1px solid rgba(255, 210, 80, 0.3);
          border-radius: 14px;
          overflow: hidden;
          min-width: 170px;
          box-shadow: 0 0 30px rgba(255, 210, 80, 0.08), 0 8px 30px rgba(0,0,0,0.5);
        }

        .pb-sb-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          background: rgba(255, 210, 80, 0.08);
          border-bottom: 1px solid rgba(255, 210, 80, 0.15);
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
          color: #ffd250;
        }

        .pb-sb-icon {
          font-size: 0.9rem;
        }

        .pb-team-row--sb {
          padding: 9px 10px;
        }

        .pb-sb-conf {
          font-size: 0.55rem;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: #6b96d4;
          width: 28px;
          flex-shrink: 0;
        }

        .pb-note {
          font-size: 0.72rem;
          color: var(--fg-faint, #4a6080);
          text-align: center;
          margin-top: 1rem;
          font-style: italic;
        }

        @media (max-width: 900px) {
          .pb-root { padding: 1rem 0; }
          .pb-game { min-width: 120px; }
          .pb-game--md { min-width: 128px; }
          .pb-superbowl-card { min-width: 150px; }
          .pb-abbr { font-size: 0.65rem; }
          .pb-logo { width: 18px; height: 18px; }
        }
      `}</style>

      <div className="pb-header">
        <div className="pb-title">{BRACKET.label}</div>
        <span className="pb-mode-badge">AI Projected</span>
      </div>

      <div className="pb-bracket">
        {/* AFC side */}
        <ConferenceColumn conf={BRACKET.afc} side="afc" mode={mode} />

        {/* Super Bowl center */}
        <div className="pb-sb-col">
          <div className="pb-sb-connector-afc" />
          <SuperBowlCard game={BRACKET.superBowl} mode={mode} />
          <div className="pb-sb-connector-nfc" />
        </div>

        {/* NFC side */}
        <ConferenceColumn conf={BRACKET.nfc} side="nfc" mode={mode} />
      </div>

      <p className="pb-note">
        Win percentages are model-generated from Monte Carlo simulations. Not a guarantee of results.
      </p>
    </div>
  );
}
