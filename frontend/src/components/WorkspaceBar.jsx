import React from "react";
import { useWorkspace } from "../workspace";

/**
 * The single, shared filter bar for season- and team-scoped pages.
 * Compact segmented controls keep the same hierarchy on desktop and mobile.
 */
export default function WorkspaceBar({ teams = [], showSeason = true, showTeam = true }) {
  const { season, seasons, setSeason, team, setTeam } = useWorkspace();
  const showTeamPicker = showTeam && teams.length > 0;

  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const popRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const searchRef = React.useRef(null);

  const current = teams.find((item) => item.code === team);
  const matches = React.useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((item) =>
      item.code.toLowerCase().includes(query)
      || String(item.name || "").toLowerCase().includes(query)
    );
  }, [teams, filter]);

  React.useEffect(() => {
    if (!open) return undefined;

    function handleOutsidePress(event) {
      if (popRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function handleEscape(event) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", handleOutsidePress);
    document.addEventListener("touchstart", handleOutsidePress);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePress);
      document.removeEventListener("touchstart", handleOutsidePress);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setFilter("");
    if (!window.matchMedia?.("(hover: none)").matches) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open]);

  function chooseTeam(code) {
    setTeam(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <section className="wsbar" aria-label="Workspace filters">
      {showSeason && (
        <div className="wsbar__group">
          <span className="wsbar__label" id="wsbar-season">Season</span>
          <div className="wsbar__pills" role="group" aria-labelledby="wsbar-season">
            {seasons.map((year) => (
              <button
                key={year}
                type="button"
                className="wsbar__pill"
                aria-label={`${year} season`}
                aria-pressed={season === year}
                onClick={() => setSeason(year)}
              >
                <span className="wsbar__year-full">{year}</span>
                <span className="wsbar__year-short" aria-hidden="true">’{String(year).slice(-2)}</span>
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
            aria-label={`Team: ${current?.name || team}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="wsbar__code">{team}</span>
            <span className="wsbar__team-name">{current?.name || team}</span>
            <span className="wsbar__caret" aria-hidden="true">⌄</span>
          </button>

          {open && (
            <div ref={popRef} className="wsbar__pop" role="listbox" aria-label="Select a team">
              <input
                ref={searchRef}
                className="wsbar__search"
                type="search"
                placeholder="Find a team"
                aria-label="Filter teams"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && matches.length) chooseTeam(matches[0].code);
                }}
              />
              <div className="wsbar__list">
                {matches.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className="wsbar__opt"
                    role="option"
                    aria-selected={item.code === team}
                    onClick={() => chooseTeam(item.code)}
                  >
                    <span>{item.name || item.code}</span>
                    <span className="wsbar__code">{item.code}</span>
                  </button>
                ))}
                {!matches.length && <div className="wsbar__empty">No team matches “{filter}”.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      <span className="wsbar__note" aria-hidden="true">Active workspace</span>
    </section>
  );
}
