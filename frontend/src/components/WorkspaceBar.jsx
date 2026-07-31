import React from "react";
import { useWorkspace } from "../workspace";

/**
 * The one place season and team are chosen, shown above every page.
 *
 * Filters belong in a single row above everything they scope, not duplicated
 * inside individual cards — which is what the app had before, when Timeline
 * carried its own season pills that changed nothing else on screen.
 */
export default function WorkspaceBar({ teams = [], showSeason = true, showTeam = true }) {
  const { season, seasons, setSeason, team, setTeam } = useWorkspace();

  /* Only render a control that actually scopes the page being shown — see
     PAGE_SCOPE in main.jsx. The bar itself isn't rendered when neither does. */
  const showTeamPicker = showTeam && teams.length > 0;

  return (
    <div className="wsbar">
      <style>{`
        .wsbar {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          flex-wrap: wrap;
          padding: 10px 14px;
          margin-bottom: 1rem;
          border: 1px solid var(--border, rgba(255,255,255,.08));
          border-radius: 12px;
          background: var(--bg-card, rgba(10,22,40,.72));
        }
        .wsbar__group { display: flex; align-items: center; gap: 8px; }
        .wsbar__label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--fg-faint, #5c7391);
        }
        .wsbar__pills { display: flex; gap: 5px; flex-wrap: wrap; }
        .wsbar__pill {
          padding: 5px 13px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 999px;
          cursor: pointer;
          border: 1px solid var(--border, rgba(255,255,255,.12));
          background: transparent;
          color: var(--fg-muted, #8ea3bd);
          transition: background .15s, border-color .15s, color .15s;
        }
        .wsbar__pill:hover {
          border-color: var(--accent, #6c63ff);
          color: var(--fg, #e2e8f0);
        }
        .wsbar__pill[aria-pressed="true"] {
          background: var(--accent, #6c63ff);
          border-color: var(--accent, #6c63ff);
          color: #fff;
        }
        .wsbar__select {
          background: var(--bg-elev, rgba(10,22,40,.95));
          border: 1px solid var(--border, rgba(255,255,255,.12));
          color: var(--fg, #e2e8f0);
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .wsbar__spacer { flex: 1 1 auto; }
        .wsbar__note { font-size: 11px; color: var(--fg-faint, #5c7391); }
        @media (max-width: 640px) {
          .wsbar { gap: .75rem; }
          .wsbar__spacer { display: none; }
        }
      `}</style>

      {showSeason && (
      <div className="wsbar__group">
        <span className="wsbar__label" id="wsbar-season">Season</span>
        <div className="wsbar__pills" role="group" aria-labelledby="wsbar-season">
          {seasons.map((y) => (
            <button
              key={y}
              type="button"
              className="wsbar__pill"
              aria-pressed={season === y}
              onClick={() => setSeason(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      )}

      {showTeamPicker && (
        <div className="wsbar__group">
          <label className="wsbar__label" htmlFor="wsbar-team">Team</label>
          <select
            id="wsbar-team"
            className="wsbar__select"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t.code} value={t.code}>{t.name || t.code}</option>
            ))}
          </select>
        </div>
      )}

      <div className="wsbar__spacer" />
      <span className="wsbar__note">
        {showSeason && showTeamPicker
          ? "Scopes this page"
          : showSeason ? "Season applies to this page" : "Team applies to this page"}
      </span>
    </div>
  );
}
