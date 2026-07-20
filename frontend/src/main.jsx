import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { api } from "./api";

// Component imports
import AIStorySimulator from "./components/AIStorySimulator";
import ClutchIndex from "./components/ClutchIndex";
import ConferenceRacePage from "./components/ConferenceRacePage";
import DetailedTeamProfilePage from "./components/DetailedTeamProfilePage";
import DivisionPowerPage from "./components/DivisionPowerPage";
import EventsAdmin from "./components/EventsAdmin";
import Footer from "./components/Footer";
import GameTable from "./components/GameTable";
import HistoryPage from "./components/HistoryPage";
import LeagueForecastPage from "./components/LeagueForecastPage";
import LeagueInsightsPage from "./components/LeagueInsightsPage";
import LiveWinProbTool from "./components/LiveWinProbTool";
import MatchupSimulatorPage from "./components/MatchupSimulatorPage";
import MustWinCard from "./components/MustWinCard";
import OrbitalDiamond from "./components/OrbitalDiamond";
import PlayerRadar from "./components/PlayerRadar";
import PlayoffGauge from "./components/PlayoffGauge";
import PlayoffPulsePage from "./components/PlayoffPulsePage";
import QuantumEngineIntegrated from "./components/QuantumEngineIntegrated";
import RatingsLabPage from "./components/RatingsLabPage";
import RecordCard from "./components/RecordCard";
import RivalTeamImpactPage from "./components/RivalTeamImpactPage";
import ScheduleStrengthPage from "./components/ScheduleStrengthPage";
import SeasonPathExplorer from "./components/SeasonPathExplorer";
import StandingsPage from "./components/StandingsPage";
import TSICard from "./components/TSICard";
import TeamComparisonPage from "./components/TeamComparisonPage";
import Timeline from "./components/Timeline";
import PlayoffBracket from "./components/PlayoffBracket";
import UserProfileCard from "./components/UserProfileCard";
import WarRoomPage from "./components/WarRoomPage";

import "./styles/global.css";
import "../style.css";
import "./styles/EventsAdmin.css";
import "./styles/Timeline.css";
import "./styles/MotionPolish.css";
import "./styles/WorkspaceConsistency.css";
import "./styles/WarRoom.css";
import "./styles/RatingsLab.css";

const CATEGORY_MAP = {
  dashboard: 'Core',
  games: 'Core',
  players: 'Core',
  predictions: 'Core',
  insights: 'Core',
  bracket: 'Core',
  warroom: 'Pro',
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

/* ── Shared Components ──────────────────────────────────────── */

function LiveTicker() {
  const [items] = useState([
    { label: "AFC #1 Seed",     value: "KC 14-3",    trend: "up" },
    { label: "NFC #1 Seed",     value: "DET 15-2",   trend: "up" },
    { label: "SB Favorite",     value: "KC 52%",     trend: "neutral" },
    { label: "Highest TSI",     value: "BAL 14.2",   trend: "up" },
    { label: "DAL Proj Wins",   value: "10.8",       trend: "up" },
    { label: "DAL Playoff Odds", value: "74%",       trend: "up" },
    { label: "Bubble Teams",    value: "SEA,LAR,DEN",trend: "down" },
    { label: "SOS Toughest",    value: "DAL",        trend: "neutral" },
    { label: "DAL SB Odds",     value: "9.4%",       trend: "up" },
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
    { id: 'dashboard',   label: 'Dashboard',        desc: 'Core season outlook' },
    { id: 'bracket',     label: 'Playoff Bracket',  desc: 'AI-projected NFL playoff bracket' },
    { id: 'games',       label: 'Games',             desc: 'Schedule and win probability' },
    { id: 'players',     label: 'Players',           desc: 'Roster profiles and comparison' },
    { id: 'predictions', label: 'Predictions',       desc: 'Model output and scenarios' },
    { id: 'insights',    label: 'Insights',          desc: 'League standings and trends' },
    { id: 'warroom',     label: 'War Room',          desc: 'Pro prediction markets + analyst chatbot' },
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
    <div className="page-container">
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
    <div className="page-container page-shell">
      <div className="page-hero reveal-up">
        <OrbitalDiamond
          className="page-hero__orbital"
          size={520}
          labels={["Record", "Schedule", "Power"]}
          glow="electric"
          ringColor="cream"
          labelColor="muted"
        />
        <div className="page-hero__copy">
          <div className="page-hero__kicker">Workspace / {title}</div>
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
          {insight && <div className="key-insight">{insight}</div>}
        </div>
      </div>
      <div className="page-body">{children}</div>
    </div>
  );
}

function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="sub-tabs" role="tablist" aria-label="Page sections">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
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
  const teamInfo = NFL_TEAMS.find((t) => t.code === selectedTeam) || { name: selectedTeam };

  return (
    <div className="page-container dashboard-page">
      <div className="cowboys-banner war-room-banner reveal-up">
        <div className="banner-content">
          <div className="page-hero__kicker">Trust Engine / Live Desk</div>
          <h1 className="hero-title">
            {teamInfo.name} <span>Postseason Desk</span>
          </h1>
          <p className="hero-kicker">
            Straight-line reads on record, schedule leverage, pressure games, and playoff odds for the {teamInfo.name}.
          </p>
          <p className="intel-note">
            Built like a film-room dashboard: fewer gimmicks, clearer signals, and faster reads.
          </p>
          <div className="dashboard-quickbar" aria-label="Dashboard signals">
            <span>100k sims</span>
            <span>Quantum v4.6</span>
            <span>NFC leverage</span>
          </div>
        </div>
        <OrbitalDiamond
          className="cowboys-banner__orbital"
          size={640}
          labels={["Record", "Schedule", "Power"]}
          glow="navy"
          ringColor="cream"
          labelColor="cream"
        />
      </div>

      <section className="workspace-section reveal-up stagger-1" style={{ marginBottom: "2.5rem" }}>
        <div className="workspace-section__head">
          <div>
            <div className="workspace-section__kicker">Primary Signals</div>
            <h2>Current playoff posture</h2>
          </div>
          <span className="workspace-section__meta">Updated live</span>
        </div>
        <div className="data-grid three-col dashboard-signal-grid">
          <RecordCard year={year} team={selectedTeam} />
          <TSICard year={year} team={selectedTeam} />
          <MustWinCard year={year} team={selectedTeam} />
        </div>
      </section>

      <section className="workspace-section reveal-up stagger-2" style={{ marginBottom: "2.5rem" }}>
        <div className="workspace-section__head">
          <div>
            <div className="workspace-section__kicker">Decision Board</div>
            <h2>Leverage and live probability</h2>
          </div>
          <span className="workspace-section__meta">Scenario ready</span>
        </div>
        <div className="dashboard-decision-grid">
          <div className="card cowboys-card animated-card">
            <div className="eyebrow">Tactical Overview</div>
            <h3>Playoff Outlook</h3>
            <p className="text-muted">
              Live team metrics, cleaner hierarchy, and what-if analysis at a glance.
            </p>
          </div>
          <LiveWinProbTool />
        </div>
      </section>

      <section className="workspace-section reveal-up stagger-3" style={{ marginBottom: "2.5rem" }}>
        <div className="workspace-section__head">
          <div>
            <div className="workspace-section__kicker">Schedule Map</div>
            <h2>Remaining path</h2>
          </div>
          <span className="workspace-section__meta">{year}</span>
        </div>
        <div className="dashboard-table-wrap">
          <GameTable year={year} team={selectedTeam} />
        </div>
      </section>
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

  return (
    <PageShell
      title="Players & Scouting"
      subtitle="Team profiles, player analysis, comparisons, and rival impact breakdowns."
    >
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="reveal-up" key={activeTab}>
        {activeTab === "team-profile" && <DetailedTeamProfilePage year={year} selectedTeam={selectedTeam} />}
        {activeTab === "compare" && <TeamComparisonPage year={year} selectedTeam={selectedTeam} />}
        {activeTab === "analytics" && <PlayerRadar />}
        {activeTab === "rival" && <RivalTeamImpactPage year={year} selectedTeam={selectedTeam} />}
      </div>
    </PageShell>
  );
}

/* ── Predictions Page (consolidated) ────────────────────────── */

function PredictionsPage({ year, selectedTeam }) {
  const [activeTab, setActiveTab] = useState("quantum");
  const tabs = [
    { id: "quantum", label: "Model Output" },
    { id: "ratings-lab", label: "Ratings Lab" },
    { id: "simulator", label: "Scenario Studio" },
    { id: "paths", label: "Season Paths" },
    { id: "forecast", label: "League Forecast" }
  ];

  return (
    <PageShell
      title="Predictions"
      subtitle="Model output, scenario planning, season paths, and league-wide forecasting."
    >
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="reveal-up" key={activeTab}>
        {activeTab === "quantum" && <QuantumEngineIntegrated />}
        {activeTab === "ratings-lab" && <RatingsLabPage year={year} selectedTeam={selectedTeam} />}
        {activeTab === "simulator" && <AIStorySimulator />}
        {activeTab === "paths" && <SeasonPathExplorer year={year} team={selectedTeam} />}
        {activeTab === "forecast" && <LeagueForecastPage year={year} />}
      </div>
    </PageShell>
  );
}

/* ── Bracket Page ────────────────────────────────────────────── */

function BracketPage({ year }) {
  return (
    <PageShell
      title="Playoff Bracket"
      subtitle="AI-projected NFL playoff bracket with Monte Carlo win probabilities for all 32 teams."
    >
      <PlayoffBracket year={year} />
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

function LinearInspector({ currentPage, selectedTeam, year }) {
  const pageLabel = currentPage
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const teamInfo = NFL_TEAMS.find((team) => team.code === selectedTeam);
  const issueCode = `${selectedTeam}-${String(pageLabel.length + year).slice(-3)}`;

  return (
    <aside className="linear-inspector" aria-label="Dashboard context">
      <div className="linear-inspector__top">
        <span className="linear-inspector__code">{issueCode}</span>
        <span className="linear-inspector__dot" />
      </div>

      <dl className="linear-inspector__list">
        <div>
          <dt>Status</dt>
          <dd><span className="linear-status-dot" /> Tracking</dd>
        </div>
        <div>
          <dt>Workspace</dt>
          <dd>{teamInfo?.name || selectedTeam}</dd>
        </div>
        <div>
          <dt>View</dt>
          <dd>{pageLabel}</dd>
        </div>
        <div>
          <dt>Season</dt>
          <dd>{year}</dd>
        </div>
      </dl>

      <div className="linear-inspector__block">
        <div className="linear-inspector__label">Model</div>
        <div className="linear-inspector__pill">Quantum v4.6</div>
      </div>
    </aside>
  );
}

/* ── Router ─────────────────────────────────────────────────── */

function useAppRouter() {
  const allowedPages = useMemo(
    () => new Set(["dashboard", "games", "players", "predictions", "insights", "bracket", "warroom", "events", "profile", "history"]),
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
        if (el.dataset.page === page) {
          el.setAttribute("aria-current", "page");
        } else {
          el.removeAttribute("aria-current");
        }
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("app-shell-ready"));
    }, 260);

    return () => window.clearTimeout(timer);
  }, []);

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
      case "bracket":
        return <BracketPage year={year} />;
      case "warroom":
        return (
          <PageShell
            title="War Room Pro"
            subtitle="Prediction markets, Star Coin positions, leaderboard standings, and live model analysis."
          >
            <WarRoomPage />
          </PageShell>
        );
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
      <div className="workspace-surface">
        <div className="workspace-main">{renderPage()}</div>
        <LinearInspector currentPage={currentPage} selectedTeam={selectedTeam} year={currentYear} />
      </div>
      <Footer />
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
