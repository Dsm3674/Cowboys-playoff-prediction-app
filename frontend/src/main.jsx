const { useEffect, useMemo, useState } = React;

function PlaceholderCard({ title, text }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="text-small text-muted">{text}</p>
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

function TeamSelector({ selectedTeam, onSelect }) {
  return (
    <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
      <label style={{ fontWeight: 700, color: "#0f172a" }} htmlFor="team-select">
        Select team
      </label>
      <select
        id="team-select"
        value={selectedTeam}
        onChange={(e) => onSelect(e.target.value)}
        style={{ padding: "0.75rem 1rem", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#fff", minWidth: "220px" }}
      >
        {NFL_TEAMS.map((team) => (
          <option key={team.code} value={team.code}>
            {team.code} — {team.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Dashboard({ year = new Date().getFullYear(), selectedTeam, onTeamChange }) {
  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const RecordCard = getGlobalComponent("RecordCard", "Record");
  const TSICard = getGlobalComponent("TSICard", "TSI");
  const MustWinCard = getGlobalComponent("MustWinCard", "Must Win");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Win Probability");
  const GameTable = getGlobalComponent("GameTable", "Schedule");

  const teamInfo = NFL_TEAMS.find((team) => team.code === selectedTeam) || { name: selectedTeam };

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
        <div>
          <h1 className="hero-title">
            {teamInfo.name} <span>Analytics</span>
          </h1>
          <div className="hero-kicker">
            Live analytics for the {teamInfo.name}.
          </div>
        </div>
        <TeamSelector selectedTeam={selectedTeam} onSelect={onTeamChange} />
      </div>

      <div className="grid-layout">
        <div>
          <UserProfileCard team={selectedTeam} />
          <RecordCard year={year} team={selectedTeam} />
          <TSICard year={year} team={selectedTeam} />
          <MustWinCard year={year} team={selectedTeam} />
        </div>

        <div>
          <div className="card">
            <h3>Playoff Outlook</h3>
            <p className="text-small text-muted">
              Live team metrics plus what-if analysis.
            </p>
          </div>

          <div style={{ marginTop: "2rem" }}>
            <LiveWinProbTool />
          </div>

          <div style={{ marginTop: "2rem" }}>
            <GameTable year={year} team={selectedTeam} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const PlayerRadar = getGlobalComponent("PlayerRadar", "Player Radar");
  const Maps = getGlobalComponent("Maps", "Maps");

  return (
    <div style={{ padding: "24px" }}>
      <h1 className="hero-title">Advanced Analytics</h1>
      <div className="grid-layout">
        <div>
          <PlayerRadar />
        </div>
        <div>
          <Maps />
        </div>
      </div>
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
      const routeEl = document.getElementById("route-indicator");
      if (routeEl) routeEl.textContent = `Route: ${page}`;

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
    }

    function handleHashChange() {
      navigate(window.location.hash, { skipHashUpdate: true });
    }

    window.setPage = navigate;

    document.querySelectorAll(".nav-link").forEach((el) => {
      el.onclick = () => navigate(el.dataset.page);
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
    switch (currentPage) {
      case "dashboard":
        return <Dashboard year={new Date().getFullYear()} selectedTeam={selectedTeam} onTeamChange={setSelectedTeam} />;

      case "simulator":
        return (
          <div style={{ padding: "24px" }}>
            <AIStorySimulator />
          </div>
        );

      case "quantum":
        return (
          <div style={{ padding: "24px" }}>
            <QuantumEngineIntegrated />
          </div>
        );

      case "analytics":
        return <AnalyticsPage />;

      case "rival":
        return (
          <div style={{ padding: "24px" }}>
            <RivalTeamImpactPage year={new Date().getFullYear()} selectedTeam={selectedTeam} />
          </div>
        );

      case "clutch":
        return (
          <div style={{ padding: "24px" }}>
            <ClutchIndex />
          </div>
        );

      case "timeline":
        return (
          <div style={{ padding: "24px" }}>
            <Timeline />
          </div>
        );

      case "paths":
        return (
          <div style={{ padding: "24px" }}>
            <SeasonPathExplorer year={new Date().getFullYear()} team={selectedTeam} />
          </div>
        );

      case "standings":
        return (
          <div style={{ padding: "24px" }}>
            <StandingsPage year={new Date().getFullYear()} />
          </div>
        );

      case "compare":
        return (
          <div style={{ padding: "24px" }}>
            <TeamComparisonPage year={new Date().getFullYear()} selectedTeam={selectedTeam} />
          </div>
        );

      case "division":
        return (
          <div style={{ padding: "24px" }}>
            <DivisionPowerPage year={new Date().getFullYear()} />
          </div>
        );

      case "forecast":
        return (
          <div style={{ padding: "24px" }}>
            <LeagueForecastPage year={new Date().getFullYear()} />
          </div>
        );

      case "playoff":
        return (
          <div style={{ padding: "24px" }}>
            <PlayoffPulsePage year={new Date().getFullYear()} />
          </div>
        );

      case "matchup":
        return (
          <div style={{ padding: "24px" }}>
            <MatchupSimulatorPage year={new Date().getFullYear()} selectedTeam={selectedTeam} />
          </div>
        );

      case "schedule-strength":
        return (
          <div style={{ padding: "24px" }}>
            <ScheduleStrengthPage year={new Date().getFullYear()} />
          </div>
        );

      case "team-profile":
        return (
          <div style={{ padding: "24px" }}>
            <DetailedTeamProfilePage year={new Date().getFullYear()} selectedTeam={selectedTeam} />
          </div>
        );

      case "conference":
        return (
          <div style={{ padding: "24px" }}>
            <ConferenceRacePage year={new Date().getFullYear()} />
          </div>
        );

      case "insights":
        return (
          <div style={{ padding: "24px" }}>
            <LeagueInsightsPage year={new Date().getFullYear()} />
          </div>
        );

      case "liveprob":
        return (
          <div style={{ padding: "24px" }}>
            <LiveWinProbTool />
          </div>
        );

      case "events":
        return (
          <div style={{ padding: "24px" }}>
            <EventsAdmin />
          </div>
        );

      case "profile":
        return (
          <div style={{ padding: "24px" }}>
            <UserProfileCard />
          </div>
        );

      case "history":
        return (
          <div style={{ padding: "24px" }}>
            <HistoryPage />
          </div>
        );

      default:
        return <Dashboard />;
    }
  }

  return (
    <div className="content-area fade-in">
      {renderPage()}

      <footer className="site-footer">
        <div className="site-footer__bottom">
          <span>&copy; {new Date().getFullYear()} LoneStar Analytics</span>
        </div>
      </footer>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.render(<App />, rootElement);
}
