const { useEffect, useMemo, useState } = React;

const CATEGORY_MAP = {
  dashboard: "Intelligence",
  analytics: "Intelligence",
  insights: "Intelligence",
  history: "Intelligence",
  profile: "Intelligence",
  simulator: "Strategy",
  matchup: "Strategy",
  paths: "Strategy",
  quantum: "Strategy",
  "team-profile": "Scouting",
  compare: "Scouting",
  "schedule-strength": "Scouting",
  rival: "Scouting",
  standings: "League HQ",
  playoff: "League HQ",
  division: "League HQ",
  conference: "League HQ",
  forecast: "League HQ",
  liveprob: "League HQ",
  clutch: "League HQ",
  timeline: "League HQ",
  events: "League HQ"
};

const PAGE_LABELS = {
  dashboard: "Dashboard",
  simulator: "AI Story Simulator",
  quantum: "Quantum Engine",
  analytics: "Analytics",
  rival: "Rival Impact",
  clutch: "Clutch Index",
  timeline: "Timeline",
  paths: "Season Paths",
  liveprob: "Live Win Probability",
  standings: "Standings",
  compare: "Team Comparison",
  division: "Division Power",
  forecast: "League Forecast",
  playoff: "Playoff Pulse",
  matchup: "Matchup Simulator",
  "schedule-strength": "Schedule Strength",
  "team-profile": "Team Profile",
  conference: "Conference Race",
  insights: "League Insights",
  events: "Events Admin",
  profile: "Profile",
  history: "History"
};

function PlaceholderCard({ title, text }) {
  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Unavailable</div>
          <h1 className="intel-title">{title}</h1>
          <p className="intel-subtitle">{text}</p>
        </div>
      </section>
    </div>
  );
}

function getGlobalComponent(name, fallbackTitle) {
  return window[name]
    ? window[name]
    : () => (
        <PlaceholderCard
          title={fallbackTitle}
          text={`${name} is unavailable right now.`}
        />
      );
}

const NFL_TEAMS = [
  { code: "ARI", name: "Arizona Cardinals" },
  { code: "ATL", name: "Atlanta Falcons" },
  { code: "BAL", name: "Baltimore Ravens" },
  { code: "BUF", name: "Buffalo Bills" },
  { code: "CAR", name: "Carolina Panthers" },
  { code: "CHI", name: "Chicago Bears" },
  { code: "CIN", name: "Cincinnati Bengals" },
  { code: "CLE", name: "Cleveland Browns" },
  { code: "DAL", name: "Dallas Cowboys" },
  { code: "DEN", name: "Denver Broncos" },
  { code: "DET", name: "Detroit Lions" },
  { code: "GB", name: "Green Bay Packers" },
  { code: "HOU", name: "Houston Texans" },
  { code: "IND", name: "Indianapolis Colts" },
  { code: "JAX", name: "Jacksonville Jaguars" },
  { code: "KC", name: "Kansas City Chiefs" },
  { code: "LV", name: "Las Vegas Raiders" },
  { code: "LAC", name: "Los Angeles Chargers" },
  { code: "LAR", name: "Los Angeles Rams" },
  { code: "MIA", name: "Miami Dolphins" },
  { code: "MIN", name: "Minnesota Vikings" },
  { code: "NE", name: "New England Patriots" },
  { code: "NO", name: "New Orleans Saints" },
  { code: "NYG", name: "New York Giants" },
  { code: "NYJ", name: "New York Jets" },
  { code: "PHI", name: "Philadelphia Eagles" },
  { code: "PIT", name: "Pittsburgh Steelers" },
  { code: "SEA", name: "Seattle Seahawks" },
  { code: "SF", name: "San Francisco 49ers" },
  { code: "TB", name: "Tampa Bay Buccaneers" },
  { code: "TEN", name: "Tennessee Titans" },
  { code: "WAS", name: "Washington Commanders" }
];

function AppTopBar({ currentPage, selectedTeam, onTeamChange, compact, onToggleCompact }) {
  const pageLabel = PAGE_LABELS[currentPage] || "Dashboard";
  const category = CATEGORY_MAP[currentPage] || "System";

  return (
    <div className="intel-topbar">
      <div className="intel-topbar__left">
        <span className="intel-live-dot" />
        <span className="intel-topbar__label">Live</span>
        <span className="intel-chip">{category}</span>
        <span className="intel-chip intel-chip--muted">{pageLabel}</span>
      </div>

      <div className="intel-topbar__right">
        <select
          className="intel-select"
          value={selectedTeam}
          onChange={(e) => onTeamChange(e.target.value)}
          style={{ minWidth: "180px" }}
        >
          {NFL_TEAMS.map((team) => (
            <option key={team.code} value={team.code}>
              {team.code} · {team.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="intel-button"
          onClick={onToggleCompact}
          title="Toggle compact density"
        >
          {compact ? "Comfortable" : "Compact"}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ year = new Date().getFullYear(), selectedTeam }) {
  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const RecordCard = getGlobalComponent("RecordCard", "Record");
  const TSICard = getGlobalComponent("TSICard", "TSI");
  const MustWinCard = getGlobalComponent("MustWinCard", "Must Win");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Win Probability");
  const GameTable = getGlobalComponent("GameTable", "Schedule");
  const PlayoffGauge = getGlobalComponent("PlayoffGauge", "Playoff Gauge");

  const teamInfo =
    NFL_TEAMS.find((team) => team.code === selectedTeam) || { name: selectedTeam };

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">War Room</div>
          <h1 className="intel-title">{teamInfo.name}</h1>
          <p className="intel-subtitle">
            High-fidelity predictive analytics for the {teamInfo.name} season.
          </p>
          <p className="intel-note">
            Unified command center for record, TSI, schedule pressure, and live win-state tools.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">Season {year}</div>
          <div className="intel-chip intel-chip--muted">{selectedTeam}</div>
        </div>
      </section>

      <section className="intel-grid intel-grid--main">
        <div className="intel-stack">
          <UserProfileCard team={selectedTeam} />
          <RecordCard year={year} team={selectedTeam} />
          <TSICard year={year} team={selectedTeam} />
          <MustWinCard year={year} team={selectedTeam} />
        </div>

        <div className="intel-stack">
          <PlayoffGauge teamCode={selectedTeam} year={year} />
          <LiveWinProbTool />
          <GameTable year={year} team={selectedTeam} />
        </div>
      </section>
    </div>
  );
}

function AnalyticsPage() {
  const PlayerRadar = getGlobalComponent("PlayerRadar", "Player Radar");
  const Maps = getGlobalComponent("Maps", "Maps");

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Advanced Analytics</div>
          <h1 className="intel-title">Player Intelligence</h1>
          <p className="intel-subtitle">
            Explore radar and map-based views of player-level performance and role profile.
          </p>
        </div>
      </section>

      <section className="intel-grid intel-grid--main">
        <PlayerRadar />
        <Maps />
      </section>
    </div>
  );
}

function useAppRouter() {
  const allowedPages = useMemo(
    () =>
      new Set([
        "dashboard",
        "simulator",
        "quantum",
        "analytics",
        "rival",
        "clutch",
        "timeline",
        "paths",
        "liveprob",
        "standings",
        "compare",
        "division",
        "forecast",
        "playoff",
        "matchup",
        "schedule-strength",
        "team-profile",
        "conference",
        "insights",
        "events",
        "profile",
        "history"
      ]),
    []
  );

  function normalizePage(page) {
    const raw = String(page || "").replace(/^#/, "").trim();
    return allowedPages.has(raw) ? raw : "dashboard";
  }

  const [currentPage, setCurrentPage] = useState(
    normalizePage(window.location.hash)
  );

  useEffect(() => {
    function updateIndicators(page) {
      const category = CATEGORY_MAP[page] || "System";
      const catEl = document.getElementById("active-category");
      const pageEl = document.getElementById("active-page");
      const barEl = document.getElementById("scroll-progress");

      if (catEl) catEl.textContent = category;
      if (pageEl) pageEl.textContent = PAGE_LABELS[page] || "Dashboard";
      if (barEl) barEl.classList.toggle("visible", page === "dashboard");

      document.querySelectorAll(".nav-link").forEach((el) => {
        el.classList.toggle("active", el.dataset.page === page);
      });
    }

    function navigate(page, options = {}) {
      const normalized = normalizePage(page);
      setCurrentPage(normalized);

      if (!options.skipHashUpdate) {
        const nextHash = `#${normalized}`;
        if (window.location.hash !== nextHash) {
          window.location.hash = normalized;
        }
      }

      updateIndicators(normalized);
      document.querySelector(".shell")?.classList.remove("menu-open");
    }

    function handleHashChange() {
      navigate(window.location.hash, { skipHashUpdate: true });
    }

    const menuToggle = document.getElementById("menu-toggle");
    const shell = document.querySelector(".shell");

    function toggleMenu() {
      shell?.classList.toggle("menu-open");
    }

    if (menuToggle) menuToggle.onclick = toggleMenu;

    window.setPage = navigate;

    document.querySelectorAll(".nav-link").forEach((el) => {
      el.onclick = () => {
        navigate(el.dataset.page);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });

    updateIndicators(currentPage);
    window.addEventListener("hashchange", handleHashChange);

    const initialHash = window.location.hash.replace("#", "");
    if (initialHash) {
      navigate(initialHash, { skipHashUpdate: true });
    } else {
      navigate("dashboard", { skipHashUpdate: true });
    }

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      document.querySelectorAll(".nav-link").forEach((el) => {
        el.onclick = null;
      });
    };
  }, [allowedPages, currentPage]);

  return currentPage;
}

function App() {
  const currentPage = useAppRouter();
  const [selectedTeam, setSelectedTeam] = useState("DAL");
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    document.body.classList.toggle("intel-compact", compact);
  }, [compact]);

  const AIStorySimulator = getGlobalComponent("AIStorySimulator", "Simulator");
  const QuantumEngineIntegrated = getGlobalComponent("QuantumEngineIntegrated", "Quantum Engine");
  const RivalTeamImpactPage = getGlobalComponent("RivalTeamImpactPage", "Rival Impact");
  const ClutchIndex = getGlobalComponent("ClutchIndex", "Clutch Index");
  const Timeline = getGlobalComponent("Timeline", "Timeline");
  const SeasonPathExplorer = getGlobalComponent("SeasonPathExplorer", "Season Paths");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Win Probability");
  const StandingsPage = getGlobalComponent("StandingsPage", "Standings");
  const TeamComparisonPage = getGlobalComponent("TeamComparisonPage", "Team Comparison");
  const DivisionPowerPage = getGlobalComponent("DivisionPowerPage", "Division Power");
  const LeagueForecastPage = getGlobalComponent("LeagueForecastPage", "League Forecast");
  const PlayoffPulsePage = getGlobalComponent("PlayoffPulsePage", "Playoff Pulse");
  const MatchupSimulatorPage = getGlobalComponent("MatchupSimulatorPage", "Matchup Simulator");
  const ScheduleStrengthPage = getGlobalComponent("ScheduleStrengthPage", "Schedule Strength");
  const DetailedTeamProfilePage = getGlobalComponent("DetailedTeamProfilePage", "Team Profile");
  const ConferenceRacePage = getGlobalComponent("ConferenceRacePage", "Conference Race");
  const LeagueInsightsPage = getGlobalComponent("LeagueInsightsPage", "League Insights");
  const EventsAdmin = getGlobalComponent("EventsAdmin", "Events Admin");
  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const HistoryPage = getGlobalComponent("HistoryPage", "History");

  function renderPage() {
    const year = new Date().getFullYear();

    switch (currentPage) {
      case "dashboard":
        return <Dashboard year={year} selectedTeam={selectedTeam} />;

      case "simulator":
        return <AIStorySimulator />;

      case "quantum":
        return <QuantumEngineIntegrated />;

      case "analytics":
        return <AnalyticsPage />;

      case "rival":
        return <RivalTeamImpactPage year={year} selectedTeam={selectedTeam} />;

      case "clutch":
        return <ClutchIndex />;

      case "timeline":
        return <Timeline />;

      case "paths":
        return <SeasonPathExplorer year={year} team={selectedTeam} />;

      case "standings":
        return <StandingsPage year={year} />;

      case "compare":
        return <TeamComparisonPage year={year} selectedTeam={selectedTeam} />;

      case "division":
        return <DivisionPowerPage year={year} />;

      case "forecast":
        return <LeagueForecastPage year={year} />;

      case "playoff":
        return <PlayoffPulsePage year={year} />;

      case "matchup":
        return <MatchupSimulatorPage year={year} selectedTeam={selectedTeam} />;

      case "schedule-strength":
        return <ScheduleStrengthPage year={year} />;

      case "team-profile":
        return <DetailedTeamProfilePage year={year} selectedTeam={selectedTeam} />;

      case "conference":
        return <ConferenceRacePage year={year} />;

      case "insights":
        return <LeagueInsightsPage year={year} />;

      case "liveprob":
        return <LiveWinProbTool />;

      case "events":
        return <EventsAdmin />;

      case "profile":
        return (
          <div className="intel-page">
            <UserProfileCard team={selectedTeam} />
          </div>
        );

      case "history":
        return <HistoryPage />;

      default:
        return <Dashboard year={year} selectedTeam={selectedTeam} />;
    }
  }

  return (
    <>
      <AppTopBar
        currentPage={currentPage}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        compact={compact}
        onToggleCompact={() => setCompact((value) => !value)}
      />

      <div key={currentPage} className="reveal-up" style={{ minHeight: "100vh" }}>
        {renderPage()}
      </div>

      <footer className="site-footer">
        <div className="site-footer__bottom">
          <span>&copy; {new Date().getFullYear()} LoneStar Analytics</span>
        </div>
      </footer>
    </>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.render(<App />, rootElement);
}
