import React from "react";
import { useWorkspace } from "../workspace";

/**
 * The one place season and team are chosen, shown above the pages they scope.
 *
 * Filters belong in a single row above everything they scope, not duplicated
 * inside individual cards. Which controls appear is decided per page by
 * PAGE_SCOPE in main.jsx — a control that filters nothing is worse than no
 * control at all.
 *
 * Mobile notes, both of which were real problems:
 *
 *  - The season pills rendered one per row at 258px wide, turning the bar into
 *    a 287px-tall stack. WorkspaceConsistency.css forces every button inside
 *    .workspace-main to width:100% below 420px; these controls are now on that
 *    rule's exception list and size to their content.
 *  - The team picker was a native <select>. On a phone that hands off to the OS
 *    picker, which covers the whole screen to change one filter. It is now a
 *    popover anchored to its trigger, capped at 46vh, with a filter box so all
 *    32 teams stay reachable without a full-screen takeover.
 */
export default function WorkspaceBar({ teams = [], showSeason = true, showTeam = true }) {
  const { season, seasons, setSeason, team, setTeam } = useWorkspace();

  /* Only render a control that actually scopes the page being shown — see
     PAGE_SCOPE in main.jsx. The bar itself isn't rendered when neither does. */
  const showTeamPicker = showTeam && teams.length > 0;

  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const popRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const searchRef = React.useRef(null);

  const current = teams.find((t) => t.code === team);

  const matches = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) => t.code.toLowerCase().includes(q) || String(t.name || "").toLowerCase().includes(q)
    );
  }, [teams, filter]);

  /* Close on outside click or Escape — a popover that traps you is no better
     than the full-screen picker it replaced. */
  React.useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setFilter("");
    /* Don't autofocus on touch — it summons the keyboard over the list. */
    if (!window.matchMedia?.("(hover: none)").matches) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function choose(code) {
    setTeam(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="wsbar">
      <style>{`
        .wsbar {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 8px 12px;
          margin-bottom: 1rem;
          border: 1px solid var(--border, rgba(255,255,255,.08));
          border-radius: 12px;
          background: var(--bg-card, rgba(10,22,40,.72));
        }
        .wsbar__group { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .wsbar__label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--fg-faint, #5c7391);
          white-space: nowrap;
        }

        /* Segmented control — one row, sized to content, at every width. */
        .wsbar__pills {
          display: inline-flex;
          gap: 3px;
          padding: 3px;
          border-radius: 999px;
          background: rgba(255,255,255,.04);
          border: 1px solid var(--border, rgba(255,255,255,.08));
        }
        .wsbar__pill {
          width: auto !important;
          min-height: 0 !important;
          flex: 0 0 auto;
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.1;
          border-radius: 999px;
          cursor: pointer;
          border: 0;
          background: transparent;
          color: var(--fg-muted, #8ea3bd);
          font-variant-numeric: tabular-nums;
          transition: background .15s, color .15s;
        }
        .wsbar__pill:hover { color: var(--fg, #e2e8f0); }
        .wsbar__pill[aria-pressed="true"] {
          background: var(--accent, #6c63ff);
          color: #fff;
        }

        /* Team picker */
        .wsbar__team { position: relative; }
        .wsbar__trigger {
          width: auto !important;
          min-height: 0 !important;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 11px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 9px;
          cursor: pointer;
          color: var(--fg, #e2e8f0);
          background: var(--bg-elev, rgba(10,22,40,.95));
          border: 1px solid var(--border, rgba(255,255,255,.12));
        }
        .wsbar__trigger:hover { border-color: var(--accent, #6c63ff); }
        .wsbar__code {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 11px;
          font-weight: 700;
          color: var(--accent, #8b83ff);
        }
        .wsbar__caret { opacity: .55; font-size: 9px; }

        .wsbar__pop {
          position: absolute;
          z-index: 60;
          top: calc(100% + 6px);
          left: 0;
          width: min(272px, calc(100vw - 40px));
          display: flex;
          flex-direction: column;
          border-radius: 12px;
          border: 1px solid var(--border, rgba(255,255,255,.12));
          background: var(--bg-elev, #0b1730);
          box-shadow: 0 18px 44px rgba(0,0,0,.55);
          overflow: hidden;
        }
        .wsbar__search {
          width: 100%;
          border: 0;
          border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
          background: transparent;
          color: var(--fg, #e2e8f0);
          font-size: 13px;
          padding: 9px 12px;
          outline: none;
        }
        .wsbar__list {
          max-height: min(46vh, 300px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 4px;
        }
        .wsbar__opt {
          width: 100% !important;
          min-height: 0 !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--fg-muted, #b9c7d9);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
        }
        .wsbar__opt:hover { background: rgba(255,255,255,.06); color: var(--fg, #e2e8f0); }
        .wsbar__opt[aria-selected="true"] {
          background: rgba(108,99,255,.18);
          color: #fff;
        }
        .wsbar__empty { padding: 14px 12px; font-size: 12px; color: var(--fg-faint, #5c7391); }

        .wsbar__spacer { flex: 1 1 auto; }
        .wsbar__note {
          font-size: 11px;
          color: var(--fg-faint, #5c7391);
          white-space: nowrap;
        }

        @media (max-width: 620px) {
          .wsbar { gap: .6rem; padding: 7px 10px; }
          .wsbar__spacer { display: none; }
          .wsbar__note { display: none; }
          .wsbar__label { font-size: 9px; letter-spacing: .1em; }
          .wsbar__pill { padding: 5px 9px; font-size: 11.5px; }
        }
        @media (max-width: 380px) {
          .wsbar__label { display: none; }
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
        <div className="wsbar__group wsbar__team">
          <span className="wsbar__label" id="wsbar-team-label">Team</span>
          <button
            ref={triggerRef}
            id="wsbar-team"
            type="button"
            className="wsbar__trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby="wsbar-team-label"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="wsbar__code">{team}</span>
            <span>{current?.name || team}</span>
            <span className="wsbar__caret" aria-hidden="true">▼</span>
          </button>

          {open && (
            <div ref={popRef} className="wsbar__pop" role="listbox" aria-label="Select a team">
              <input
                ref={searchRef}
                className="wsbar__search"
                type="text"
                placeholder="Filter teams…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches.length) choose(matches[0].code);
                }}
              />
              <div className="wsbar__list">
                {matches.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    className="wsbar__opt"
                    role="option"
                    aria-selected={t.code === team}
                    onClick={() => choose(t.code)}
                  >
                    <span>{t.name || t.code}</span>
                    <span className="wsbar__code">{t.code}</span>
                  </button>
                ))}
                {!matches.length && <div className="wsbar__empty">No team matches “{filter}”.</div>}
              </div>
            </div>
          )}
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
