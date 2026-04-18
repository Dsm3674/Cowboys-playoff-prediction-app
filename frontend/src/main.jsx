const { useEffect, useMemo, useState } = React;

const CATEGORY_MAP = {
  dashboard: 'Core',
  games: 'Core',
  players: 'Core',
  predictions: 'Core',
  insights: 'Core',
  events: 'System',
  profile: 'System',
  history: 'System'
};

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
  { code: "GB",  name: "Green Bay Packers" },
  { code: "HOU", name: "Houston Texans" },
  { code: "IND", name: "Indianapolis Colts" },
  { code: "JAX", name: "Jacksonville Jaguars" },
  { code: "KC",  name: "Kansas City Chiefs" },
  { code: "LV",  name: "Las Vegas Raiders" },
  { code: "LAC", name: "Los Angeles Chargers" },
  { code: "LAR", name: "Los Angeles Rams" },
  { code: "MIA", name: "Miami Dolphins" },
  { code: "MIN", name: "Minnesota Vikings" },
  { code: "NE",  name: "New England Patriots" },
  { code: "NO",  name: "New Orleans Saints" },
  { code: "NYG", name: "New York Giants" },
  { code: "NYJ", name: "New York Jets" },
  { code: "PHI", name: "Philadelphia Eagles" },
  { code: "PIT", name: "Pittsburgh Steelers" },
  { code: "SEA", name: "Seattle Seahawks" },
  { code: "SF",  name: "San Francisco 49ers" },
  { code: "TB",  name: "Tampa Bay Buccaneers" },
  { code: "TEN", name: "Tennessee Titans" },
  { code: "WAS", name: "Washington Commanders" }
];

function getGlobalComponent(name, fallbackTitle) {
  return window[name]
    ? window[name]
    : () => (
        <div className="card">
          <h3>{fallbackTitle}</h3>
          <p className="text-muted">{name} is unavailable right now.</p>
        </div>
      );
}

/* ── Shared Components ──────────────────────────────────────── */

function LiveTicker() {
  const [items, setItems] = useState([
    { label: "DAL Proj Wins", value: "11", trend: "up" },
    { label: "Top Seed", value: "SF", trend: "neutral" },
    { label: "Highest TSI", value: "BAL (14.2)", trend: "up" },
    { label: "Playoff Bubble", value: "SEA, LAR", trend: "down" },
    { label: "Strength of Sched", value: "DAL (Toughest)", trend: "neutral" }
  ]);

  return (
    <div className="live-ticker-wrap">
      <div className="ticker-label">Live</div>
      <div className="ticker-content">
        {[...items, ...items, ...items].map((item, i) => (
          <div key={i} className="ticker-item">
            {item.label}: <span className="text-accent">{item.value}</span>
            {item.trend === 'up' && <span style={{color: 'var(--accent-success)', marginLeft: '4px'}}>▲</span>}
            {item.trend === 'down' && <span style={{color: 'var(--accent-danger)', marginLeft: '4px'}}>▼</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandPalette({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pages = [
    { id: 'dashboard', label: 'Dashboard', desc: 'Core War Room metrics' },
    { id: 'games', label: 'Games', desc: 'Schedule and Win Probability' },
    { id: 'players', label: 'Players', desc: 'Roster and Draft' },
    { id: 'predictions', label: 'Predictions', desc: 'Quantum Engine Forecasts' },
    { id: 'insights', label: 'Insights', desc: 'League-wide intelligence' },
  ];

  const results = pages.filter(p => p.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="cmd-k-overlay visible" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="cmd-k-modal">
        <div className="cmd-k-input-wrap">
          <span style={{color: 'var(--accent)', fontSize: '1.2rem', fontFamily: 'var(--font-display)'}}>⌘</span>
          <input 
            autoFocus
            className="cmd-k-input" 
            placeholder="Search pages or press Esc to close..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="cmd-k-results">
          {results.map(res => (
            <div key={res.id} className="cmd-k-item" onClick={() => { onNavigate(res.id); onClose(); }}>
              <span>{res.label}</span>
              <span className="cmd-k-item-meta">{res.desc}</span>
            </div>
          ))}
          {results.length === 0 && <div style={{padding: '1rem', color: 'var(--muted)', fontFamily: 'var(--font-ui)', fontSize: '0.85rem'}}>No results found.</div>}
        </div>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <div className="skeleton-block skeleton-row h-lg w-60"></div>
      <div className="skeleton-block skeleton-row w-80"></div>
      <div className="skeleton-block skeleton-row w-40"></div>
      <div style={{ marginTop: "2rem" }} className="data-grid three-col">
        {[1,2,3].map(i => (
          <div key={i} className="skeleton-block" style={{ height: "100px", borderRadius: "8px" }}></div>
        ))}
      </div>
      <div className="skeleton-block" style={{ height: "200px", borderRadius: "8px", marginTop: "1.25rem" }}></div>
    </div>
  );
}

function PageShell({ title, subtitle, insight, children }) {
  return (
    <div style={{ padding: "1.5rem" }}>
      <div className="page-hero">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {insight && <div className="key-insight">{insight}</div>}
      </div>
      {children}
    </div>
  );
}

function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="sub-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`sub-tab${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────────────────── */

function Dashboard({ year = new Date().getFullYear(), selectedTeam }) {
  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const RecordCard = getGlobalComponent("RecordCard", "Record");
  const TSICard = getGlobalComponent("TSICard", "TSI");
  const MustWinCard = getGlobalComponent("MustWinCard", "Must Win");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Win Probability");
  const GameTable = getGlobalComponent("GameTable", "Schedule");
  const PlayoffGauge = getGlobalComponent("PlayoffGauge", "Playoff Gauge");

  const teamInfo = NFL_TEAMS.find((t) => t.code === selectedTeam) || { name: selectedTeam };

  return (
    <div style={{ padding: "1.5rem" }}>
      <div className="cowboys-banner war-room-banner">
        <div className="banner-content">
          <h1 className="hero-title">
            {teamInfo.name} <span>Playoff Pulse</span>
          </h1>
          <p className="hero-kicker">
            Dark navy playoff analytics and live season intelligence for the {teamInfo.name}.
          </p>
          <p className="intel-note">
            Cowboys-inspired command center for record, TSI, schedule leverage, and live win-state tools.
          </p>
        </div>
      </div>

      <div className="data-grid three-col" style={{ marginBottom: "1.5rem" }}>
        <div className="reveal-up stagger-1">
          <RecordCard year={year} team={selectedTeam} />
        </div>
        <div className="reveal-up stagger-2">
          <TSICard year={year} team={selectedTeam} />
        </div>
        <div className="reveal-up stagger-3">
          <MustWinCard year={year} team={selectedTeam} />
        </div>
      </div>

      <div className="data-grid">
        <div className="reveal-up stagger-3">
          <div className="card cowboys-card">
            <div className="eyebrow">Playoff Snapshot</div>
            <h3>Playoff Outlook</h3>
            <p className="text-muted">
              Live team metrics, cleaner hierarchy, and what-if analysis at a glance.
            </p>
          </div>
          <LiveWinProbTool />
        </div>
        <div className="reveal-up stagger-4">
          <GameTable year={year} team={selectedTeam} />
        </div>
      </div>
    </div>
  );
}

/* ── Games Page (consolidated) ──────────────────────────────── */

function GamesPage({ year, selectedTeam }) {
  const [activeTab, setActiveTab] = useState("schedule-strength");
  const tabs = [
    { id: "schedule-strength", label: "Schedule Strength" },
    { id: "matchup", label: "Matchup Simulator" },
    { id: "liveprob", label: "Live Win Prob" }
  ];

  const ScheduleStrengthPage = getGlobalComponent("ScheduleStrengthPage", "Schedule Strength");
  const MatchupSimulatorPage = getGlobalComponent("MatchupSimulatorPage", "Matchup Simulator");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Win Probability");

  return (
    <PageShell
      title="Games"
      subtitle="Schedule analysis, matchup simulations, and live win probability tools."
    >
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="reveal-up" key={activeTab}>
        {activeTab === "schedule-strength" && <ScheduleStrengthPage year={year} />}
        {activeTab === "matchup" && <MatchupSimulatorPage year={year} selectedTeam={selectedTeam} />}
        {activeTab === "liveprob" && <LiveWinProbTool />}
      </div>
    </PageShell>
  );
}

/* ── Players Page (consolidated) ────────────────────────────── */

function PlayersPage({ year, selectedTeam }) {
  const [activeTab, setActiveTab] = useState("team-profile");
  const tabs = [
    { id: "team-profile", label: "Team Profile" },
    { id: "compare", label: "Comparison" },
    { id: "analytics", label: "Player Radar" },
    { id: "rival", label: "Rival Impact" }
  ];

  const DetailedTeamProfilePage = getGlobalComponent("DetailedTeamProfilePage", "Team Profile");
  const TeamComparisonPage = getGlobalComponent("TeamComparisonPage", "Team Comparison");
  const PlayerRadar = getGlobalComponent("PlayerRadar", "Player Radar");
  const Maps = getGlobalComponent("Maps", "Maps");
  const RivalTeamImpactPage = getGlobalComponent("RivalTeamImpactPage", "Rival Impact");

  return (
    <PageShell
      title="Players & Scouting"
      subtitle="Team profiles, player analysis, comparisons, and rival impact breakdowns."
    >
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="reveal-up" key={activeTab}>
        {activeTab === "team-profile" && <DetailedTeamProfilePage year={year} selectedTeam={selectedTeam} />}
        {activeTab === "compare" && <TeamComparisonPage year={year} selectedTeam={selectedTeam} />}
        {activeTab === "analytics" && (
          <div className="data-grid">
            <PlayerRadar />
            <Maps />
          </div>
        )}
        {activeTab === "rival" && <RivalTeamImpactPage year={year} selectedTeam={selectedTeam} />}
      </div>
    </PageShell>
  );
}

/* ── Predictions Page (consolidated) ────────────────────────── */

function PredictionsPage({ year, selectedTeam }) {
  const [activeTab, setActiveTab] = useState("quantum");
  const tabs = [
    { id: "quantum", label: "Quantum Engine" },
    { id: "simulator", label: "AI Simulator" },
    { id: "paths", label: "Season Paths" },
    { id: "forecast", label: "League Forecast" }
  ];

  const QuantumEngineIntegrated = getGlobalComponent("QuantumEngineIntegrated", "Quantum Engine");
  const AIStorySimulator = getGlobalComponent("AIStorySimulator", "Simulator");
  const SeasonPathExplorer = getGlobalComponent("SeasonPathExplorer", "Season Paths");
  const LeagueForecastPage = getGlobalComponent("LeagueForecastPage", "League Forecast");

  return (
    <PageShell
      title="Predictions"
      subtitle="Quantum simulation, AI story analysis, season paths, and league-wide forecasting."
    >
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="reveal-up" key={activeTab}>
        {activeTab === "quantum" && <QuantumEngineIntegrated />}
        {activeTab === "simulator" && <AIStorySimulator />}
        {activeTab === "paths" && <SeasonPathExplorer year={year} team={selectedTeam} />}
        {activeTab === "forecast" && <LeagueForecastPage year={year} />}
      </div>
    </PageShell>
  );
}

/* ── Insights Page (consolidated) ───────────────────────────── */

function InsightsPage({ year, selectedTeam }) {
  const [activeTab, setActiveTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "standings", label: "Standings" },
    { id: "playoff", label: "Playoff Pulse" },
    { id: "division", label: "Divisions" },
    { id: "conference", label: "Conference" },
    { id: "clutch", label: "Clutch Index" },
    { id: "timeline", label: "Timeline" }
  ];

  const LeagueInsightsPage = getGlobalComponent("LeagueInsightsPage", "League Insights");
  const StandingsPage = getGlobalComponent("StandingsPage", "Standings");
  const PlayoffPulsePage = getGlobalComponent("PlayoffPulsePage", "Playoff Pulse");
  const DivisionPowerPage = getGlobalComponent("DivisionPowerPage", "Division Power");
  const ConferenceRacePage = getGlobalComponent("ConferenceRacePage", "Conference Race");
  const ClutchIndex = getGlobalComponent("ClutchIndex", "Clutch Index");
  const Timeline = getGlobalComponent("Timeline", "Timeline");

  return (
    <PageShell
      title="Insights"
      subtitle="League-wide analytics, standings, playoff odds, division rankings, and historical trends."
    >
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="reveal-up" key={activeTab}>
        {activeTab === "overview" && <LeagueInsightsPage year={year} />}
        {activeTab === "standings" && <StandingsPage year={year} />}
        {activeTab === "playoff" && <PlayoffPulsePage year={year} />}
        {activeTab === "division" && <DivisionPowerPage year={year} />}
        {activeTab === "conference" && <ConferenceRacePage year={year} />}
        {activeTab === "clutch" && <ClutchIndex />}
        {activeTab === "timeline" && <Timeline />}
      </div>
    </PageShell>
  );
}

/* ── Router ─────────────────────────────────────────────────── */

function useAppRouter() {
  const allowedPages = useMemo(
    () => new Set(["dashboard", "games", "players", "predictions", "insights", "events", "profile", "history"]),
    []
  );

  function normalizePage(page) {
    const raw = String(page || "").replace(/^#/, "").trim();
    return allowedPages.has(raw) ? raw : "dashboard";
  }

  const [currentPage, setCurrentPage] = useState(normalizePage(window.location.hash));

  useEffect(() => {
    function updateIndicators(page) {
      const category = CATEGORY_MAP[page] || 'Core';
      const catEl = document.getElementById("active-category");
      const pageEl = document.getElementById("active-page");
      const barEl = document.getElementById("scroll-progress");

      if (catEl) catEl.textContent = category;
      if (pageEl) {
        const rawTitle = page.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        pageEl.textContent = rawTitle;
      }
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
        if (window.location.hash !== nextHash) window.location.hash = normalized;
      }
      updateIndicators(normalized);
      document.querySelector('.shell')?.classList.remove('menu-open');
    }

    function handleHashChange() {
      navigate(window.location.hash, { skipHashUpdate: true });
    }

    const menuToggle = document.getElementById('menu-toggle');
    const shell = document.querySelector('.shell');
    if (menuToggle) menuToggle.onclick = () => shell?.classList.toggle('menu-open');

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
      document.querySelectorAll(".nav-link").forEach((el) => { el.onclick = null; });
    };
  }, [allowedPages, currentPage]);

  return currentPage;
}

/* ── App ────────────────────────────────────────────────────── */

function App() {
  const currentPage = useAppRouter();
  const [selectedTeam, setSelectedTeam] = useState("DAL");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    function handleGlobalKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const EventsAdmin = getGlobalComponent("EventsAdmin", "Events Admin");
  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const HistoryPage = getGlobalComponent("HistoryPage", "History");

  function renderPage() {
    const year = currentYear;
    switch (currentPage) {
      case "dashboard":
        return <Dashboard year={year} selectedTeam={selectedTeam} />;
      case "games":
        return <GamesPage year={year} selectedTeam={selectedTeam} />;
      case "players":
        return <PlayersPage year={year} selectedTeam={selectedTeam} />;
      case "predictions":
        return <PredictionsPage year={year} selectedTeam={selectedTeam} />;
      case "insights":
        return <InsightsPage year={year} selectedTeam={selectedTeam} />;
      case "events":
        return <EventsAdmin />;
      case "profile":
        return <UserProfileCard team={selectedTeam} />;
      case "history":
        return <HistoryPage />;
      default:
        return <Dashboard year={year} selectedTeam={selectedTeam} />;
    }
  }

  return (
    <div className="app-container">
      <LiveTicker />
      {renderPage()}
      <CommandPalette 
        isOpen={paletteOpen} 
        onClose={() => setPaletteOpen(false)} 
        onNavigate={(page) => window.setPage(page)} 
      />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
