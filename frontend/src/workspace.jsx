import React from "react";

/**
 * Workspace context — the season and team every page reads from.
 *
 * Before this existed, the app rendered two different seasons at once. App
 * passed `new Date().getFullYear()` down to Standings, Games and Predictions,
 * while ClutchIndex hard-coded 2027, Timeline defaulted to 2027 with its own
 * private pill selector, and RivalTeamImpactPage defaulted to 2027 — so the
 * Insights page could show 2026 standings beside a 2027 clutch index, with no
 * way to tell they disagreed. `selectedTeam` had the mirror problem: it lived
 * in App state and was threaded through every page, but nothing ever called
 * setSelectedTeam, so it was permanently "DAL".
 *
 * One provider, one control in the toolbar, every page follows.
 *
 * useWorkspace() falls back to sane defaults when no provider is mounted, so a
 * component can still be rendered standalone (tests, the window.* globals the
 * legacy shell pokes at) without blowing up.
 */

export const SEASONS = [2027, 2026, 2025, 2024];
export const DEFAULT_SEASON = SEASONS[0];
export const DEFAULT_TEAM = "DAL";

const STORAGE_KEY = "lonestar_workspace_v1";

const WorkspaceContext = React.createContext(null);

function readStored() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    const season = SEASONS.includes(Number(raw?.season)) ? Number(raw.season) : DEFAULT_SEASON;
    const team = typeof raw?.team === "string" && raw.team ? raw.team : DEFAULT_TEAM;
    return { season, team };
  } catch (_err) {
    return { season: DEFAULT_SEASON, team: DEFAULT_TEAM };
  }
}

export function WorkspaceProvider({ children }) {
  const [state, setState] = React.useState(readStored);

  /* Persist so a reload or a jump through the legacy shell nav doesn't silently
     reset which season you were looking at. */
  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_err) { /* private mode — the session still works, it just won't stick */ }
  }, [state]);

  const value = React.useMemo(() => ({
    season: state.season,
    team: state.team,
    seasons: SEASONS,
    setSeason: (season) => setState((s) => ({ ...s, season: Number(season) })),
    setTeam: (team) => setState((s) => ({ ...s, team: String(team || DEFAULT_TEAM) })),
  }), [state]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext);
  if (ctx) return ctx;
  /* No provider (standalone render) — read-only defaults rather than a crash. */
  return {
    season: DEFAULT_SEASON,
    team: DEFAULT_TEAM,
    seasons: SEASONS,
    setSeason: () => {},
    setTeam: () => {},
  };
}

/** Convenience for the many components that only care about the season. */
export function useSeason() {
  return useWorkspace().season;
}
