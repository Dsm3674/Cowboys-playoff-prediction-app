function PredictionPanel() {
  const [pred, setPred] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [history, setHistory] = React.useState([]);

  const loadHistory = () => {
    try {
      const profile = JSON.parse(localStorage.getItem("ls_profile") || "null");
      if (!profile || !profile.username) {
        setHistory([]);
        return;
      }
      const key = `ls_predictions_${profile.username}`;
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      setHistory(saved);
    } catch (e) {
      console.warn("PredictionPanel: failed to load history", e);
      setHistory([]);
    }
  };

  React.useEffect(() => {
    loadHistory();
  }, []);

  const saveToHistory = (prediction) => {
    try {
      const profile = JSON.parse(localStorage.getItem("ls_profile") || "null");
      if (!profile || !profile.username) return;

      const key = `ls_predictions_${profile.username}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      const entry = {
        ts: new Date().toISOString(),
        playoffs: prediction.playoff_probability,
        superBowl: prediction.superbowl_probability,
      };
      const updated = [entry, ...existing].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(updated));
      setHistory(updated);
    } catch (e) {
      console.warn("PredictionPanel: failed to save history", e);
    }
  };

  const fetchPrediction = () => {
    setLoading(true);
    setError(null);

    window.api
      .generatePrediction()
      .then((data) => {
        if (data.success) {
          setPred(data.prediction);
          saveToHistory(data.prediction);
        } else {
          setError("Prediction service returned no result");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div
      className="card"
      style={{
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div>
          <div className="eyebrow">Monte Carlo Engine</div>
          <h3 style={{ margin: 0 }}>Playoff Odds (AI Model)</h3>
        </div>

        <button
          onClick={fetchPrediction}
          disabled={loading}
          style={{
            background: "#003594",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            opacity: loading ? 0.6 : 1,
            fontSize: "0.8rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {loading ? "Running..." : "Run Simulation"}
        </button>
      </div>

      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 0 }}>
        Under the hood: we take real scoring data, estimate team strength, and
        then simulate thousands of seasons to estimate how often a playoff run
        appears. It’s not a crystal ball, but it’s a fun stress test.
      </p>

      {error && <p style={{ color: "#d00", marginTop: 0 }}>{error}</p>}

      {!pred ? (
        <p style={{ fontStyle: "italic", color: "#666" }}>
          Run the simulation to see current playoff and Super Bowl odds.
        </p>
      ) : (
        <div
          className="pulse-glow"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginTop: "0.5rem",
          }}
        >
          <div
            style={{
              background: "#f0f9ff",
              padding: "1rem",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#555" }}>Make Playoffs</div>
            <div
              style={{
                fontSize: "1.6rem",
                color: "#003594",
                fontWeight: "bold",
              }}
            >
              {(pred.playoff_probability * 100).toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              background: "#fff0f0",
              padding: "1rem",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#555" }}>Super Bowl</div>
            <div
              style={{
                fontSize: "1.6rem",
                color: "#d20a0a",
                fontWeight: "bold",
              }}
            >
              {(pred.superbowl_probability * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ marginBottom: "0.5rem" }}>Your Prediction History</h4>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 0 }}>
            Saved locally to your browser and tied to your current username.
            Change your profile name to track different “what if” universes.
          </p>
          <ul
            style={{ listStyle: "none", paddingLeft: 0, fontSize: "0.85rem" }}
          >
            {history.map((h, idx) => (
              <li key={idx}>
                <strong>
                  {new Date(h.ts).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                {": "}
                Playoffs {(h.playoffs * 100).toFixed(1)}%, SB{" "}
                {(h.superBowl * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* --- NEW: tiny components to expand app experience --- */

function NoticeCard() {
  return (
    <div className="card card--accent">
      <div className="eyebrow">How to use this dashboard</div>
      <h3 style={{ marginTop: 0 }}>Game plan for data nerds & fans</h3>
      <ul
        style={{
          margin: 0,
          paddingLeft: "1.25rem",
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        <li>
          <strong>Dashboard:</strong> current record, schedule, star player radar,
          and quick playoff odds.
        </li>
        <li>
          <strong>AI Simulator:</strong> flip wild switches like QB injuries or easy
          schedules and see how the model reacts.
        </li>
        <li>
          <strong>Player Radar:</strong> visualize how Dak, CeeDee, and Bland shape
          the team across consistency, explosiveness, and more.
        </li>
        <li>
          <strong>Profile:</strong> save a username, theme, and your own prediction
          history in local storage.
        </li>
        <li>
          <strong>Our Story:</strong> browse a database-backed history of prediction
          snapshots over time.
        </li>
      </ul>
    </div>
  );
}

function AboutProjectCard() {
  return (
    <div className="card">
      <div className="eyebrow">About the project</div>
      <h3 style={{ marginTop: 0 }}>Why LoneStar Analytics exists</h3>
      <p style={{ fontSize: "0.9rem", color: "#4b5563" }}>
        This app started as a “can we quantify the feeling of watching the Cowboys
        blow a 4th quarter lead?” experiment. It grew into a full-stack project
        mixing real data, simulation, and a little bit of storytelling.
      </p>
      <p style={{ fontSize: "0.9rem", color: "#4b5563" }}>
        On the backend we pull schedule and stats from public ESPN endpoints,
        store predictions in a database, and expose everything through a small
        Node/Express API. On the frontend we stitch it together using React,
        Chart.js, and some old-school browser-based JSX.
      </p>
      <p style={{ fontSize: "0.9rem", color: "#4b5563" }}>
        It&apos;s designed to be{' '}
        <strong>readable, hackable, and extendable</strong> so you can plug in new
        models, add teams, or re-skin it for other sports.
      </p>
    </div>
  );
}

function App() {
  const currentYear = new Date().getFullYear();
  const page = window.currentPage || "dashboard";

  const renderPage = () => {
    if (page === "dashboard") {
      return (
        <div className="content-area">
          <header
            style={{
              marginBottom: "2rem",
              borderBottom: "3px solid #111827",
              paddingBottom: "1.3rem",
            }}
          >
            <div className="hero-kicker">Dallas · Data · Drama</div>
            <h1 className="hero-title">
              LoneStar <span>Analytics</span>
            </h1>
            <p style={{ color: "#4b5563", maxWidth: "620px", fontSize: "0.95rem" }}>
              A live, fan-made dashboard that blends NFL data, Monte Carlo simulations,
              and visuals to explore how often the Dallas Cowboys punch their ticket to
              January football.
            </p>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.4fr)",
              gap: "2rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <UserProfileCard />
              <RecordCard year={currentYear} />
              <PredictionPanel />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <GameTable year={currentYear} />
              <PlayerRadar />
              <NoticeCard />
            </div>
          </div>

          <AboutProjectCard />
        </div>
      );
    }

    if (page === "simulator") {
      return (
        <div className="content-area">
          <header
            style={{
              marginBottom: "1.5rem",
              borderBottom: "2px solid #111827",
              paddingBottom: "0.8rem",
            }}
          >
            <div className="eyebrow">What-if Engine</div>
            <h2 style={{ margin: 0 }}>AI Story Simulator</h2>
            <p style={{ color: "#4b5563", maxWidth: "560px", fontSize: "0.9rem" }}>
              Switch between model types, dial in scenarios, and generate a narrative
              about how the Cowboys season might twist based on injuries, schedule
              quirks, and weather chaos.
            </p>
          </header>
          <AIStorySimulator />
        </div>
      );
    }

    if (page === "radar") {
      return (
        <div className="content-area">
          <header
            style={{
              marginBottom: "1.5rem",
              borderBottom: "2px solid #111827",
              paddingBottom: "0.8rem",
            }}
          >
            <div className="eyebrow">Star Impact Map</div>
            <h2 style={{ margin: 0 }}>Player Impact Radar</h2>
            <p style={{ color: "#4b5563", maxWidth: "560px", fontSize: "0.9rem" }}>
              Compare Dak Prescott, CeeDee Lamb, and Daron Bland across offense,
              explosiveness, consistency, clutch, and durability. Toggle each star to see
              how the shape of the team changes.
            </p>
          </header>
          <div className="card">
            <PlayerRadar />
          </div>
        </div>
      );
    }

    if (page === "profile") {
      return (
        <div className="content-area">
          <header
            style={{
              marginBottom: "1.5rem",
              borderBottom: "2px solid #111827",
              paddingBottom: "0.8rem",
            }}
          >
            <div className="eyebrow">Customization</div>
            <h2 style={{ margin: 0 }}>Your Fan Profile</h2>
            <p style={{ color: "#4b5563", maxWidth: "560px", fontSize: "0.9rem" }}>
              Pick a username, lock in a theme, and let the app remember your prediction
              history. Everything is stored locally on your device—no accounts, no
              tracking.
            </p>
          </header>
          <UserProfileCard />
        </div>
      );
    }

    if (page === "history") {
      return (
        <div className="content-area">
          <header
            style={{
              marginBottom: "1.5rem",
              borderBottom: "2px solid #111827",
              paddingBottom: "0.8rem",
            }}
          >
            <div className="eyebrow">Time Machine</div>
            <h2 style={{ margin: 0 }}>Prediction History</h2>
            <p style={{ color: "#4b5563", maxWidth: "560px", fontSize: "0.9rem" }}>
              Every time your backend generates a new prediction, it can be persisted to
              the database. This table lets you scroll back through those snapshots and
              see how optimism (or pain) evolved week by week.
            </p>
          </header>
            <HistoryPage />
        </div>
      );
    }

    return (
      <div className="content-area">
        <div className="card">
          <h2>Unknown page.</h2>
          <p>
            The page you requested doesn&apos;t exist in this build. Try the
            <strong> Dashboard</strong> tab instead.
          </p>
        </div>
      </div>
    );
  };

  // outer container (App root)
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "2rem 1.25rem 3rem",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {renderPage()}
    </div>
  );
}

// ---- Simple global router for nav bar ----
window.currentPage = window.currentPage || "dashboard";

function renderApp() {
  ReactDOM.render(<App />, document.getElementById("root"));
}

window.setPage = function (page) {
  window.currentPage = page;

  // update active nav link
  const links = document.querySelectorAll(".nav-link");
  links.forEach((el) => {
    const p = el.getAttribute("data-page");
    if (p === page) el.classList.add("active");
    else el.classList.remove("active");
  });

  renderApp();
};

// initial render with correct active tab
window.setPage(window.currentPage);


