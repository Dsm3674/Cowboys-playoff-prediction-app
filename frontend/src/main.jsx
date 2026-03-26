const { useEffect, useMemo, useState } = React;

function PlaceholderCard({ title, text }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="text-small text-muted">{text}</p>
    </div>
  );
}

function PredictionPanel() {
  return (
    <div className="card">
      <h3>Playoff Outlook</h3>
      <p className="text-small text-muted">
        The live frontend only exposes deterministic and data-backed views.
      </p>
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

function Dashboard() {
  const year = new Date().getFullYear();

  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const RecordCard = getGlobalComponent("RecordCard", "Record");
  const TSICard = getGlobalComponent("TSICard", "TSI");
  const MustWinCard = getGlobalComponent("MustWinCard", "Must Win");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Win Probability");
  const GameTable = getGlobalComponent("GameTable", "Schedule");

  return (
    <div style={{ padding: "24px" }}>
      <h1 className="hero-title">
        LoneStar <span>Analytics</span>
      </h1>

      <div className="hero-kicker">
        Dallas Cowboys deterministic analytics dashboard
      </div>

      <div className="grid-layout">
        <div>
          <UserProfileCard />
          <RecordCard year={year} />
          <TSICard year={year} />
          <MustWinCard year={year} />
        </div>

        <div>
          <PredictionPanel />

          <div style={{ marginTop: "2rem" }}>
            <LiveWinProbTool />
          </div>

          <div style={{ marginTop: "2rem" }}>
            <GameTable year={year} />
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

function useRouter() {
  const allowedPages = useMemo(
    () =>
      new Set([
        "dashboard",
        "analytics",
        "rival",
        "clutch",
        "timeline",
        "paths",
        "liveprob",
        "events",
        "profile",
        "history",
        "simulator"
      ]),
    []
  );

  const normalizePage = (page) => {
    const raw = String(page || "").replace(/^#/, "").trim();
    if (raw === "quantum") return "dashboard";
    return allowedPages.has(raw) ? raw : "dashboard";
  };

  const [currentPage, setCurrentPage] = useState(
    normalizePage(window.location.hash)
  );

  useEffect(() => {
    function syncRouteUi(page) {
      const routeEl = document.getElementById("route-indicator");
      if (routeEl) routeEl.textContent = `Route: ${page}`;

      document.querySelectorAll(".nav-link").forEach((el) => {
        el.classList.toggle("active", el.dataset.page === page);
      });
    }

    function navigate(nextPage, options = {}) {
      const page = normalizePage(nextPage);

      setCurrentPage(page);

      if (!options.skipHashUpdate) {
        const nextHash = `#${page}`;
        if (window.location.hash !== nextHash) {
          history.replaceState(null, "", nextHash);
        }
      }

      syncRouteUi(page);
    }

    function handleHashChange() {
      navigate(window.location.hash, { skipHashUpdate: true });
    }

    window.appRouter = {
      go: navigate,
      current: () => normalizePage(window.location.hash || currentPage)
    };

    document.querySelectorAll(".nav-link").forEach((el) => {
      el.onclick = () => navigate(el.dataset.page);
    });

    syncRouteUi(currentPage);

    window.addEventListener("hashchange", handleHashChange);

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
  const currentPage = useRouter();

  const RivalTeamImpactPage = getGlobalComponent("RivalTeamImpactPage", "Rival Impact");
  const ClutchIndex = getGlobalComponent("ClutchIndex", "Clutch Index");
  const Timeline = getGlobalComponent("Timeline", "Timeline");
  const SeasonPathExplorer = getGlobalComponent("SeasonPathExplorer", "Season Paths");
  const LiveWinProbTool = getGlobalComponent("LiveWinProbTool", "Live Win Probability");
  const EventsAdmin = getGlobalComponent("EventsAdmin", "Events Admin");
  const UserProfileCard = getGlobalComponent("UserProfileCard", "Profile");
  const HistoryPage = getGlobalComponent("HistoryPage", "History");
  const AIStorySimulator = getGlobalComponent("AIStorySimulator", "Simulator");

  function renderPage() {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;

      case "analytics":
        return <AnalyticsPage />;

      case "rival":
        return (
          <div style={{ padding: "24px" }}>
            <RivalTeamImpactPage year={new Date().getFullYear()} />
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
            <SeasonPathExplorer />
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

      case "simulator":
        return (
          <div style={{ padding: "24px" }}>
            <AIStorySimulator />
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
