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

    window
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
      style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "10px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
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
        <h3 style={{ margin: 0 }}>Playoff Odds (AI Model)</h3>

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
          }}
        >
          {loading ? "Running..." : "Run Simulation"}
        </button>
      </div>

      {error && <p style={{ color: "#d00", marginTop: 0 }}>{error}</p>}

      {!pred ? (
        <p style={{ fontStyle: "italic", color: "#666" }}>
          Run the simulation to see playoff odds.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
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
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ marginBottom: "0.5rem" }}>Your Prediction History</h4>
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

function App() {
  const currentYear = new Date().getFullYear();
  const page = window.currentPage || "dashboard";

  const renderPage = () => {
    if (page === "dashboard") {
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2rem",
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            <UserProfileCard />
            <RecordCard year={currentYear} />
            <PredictionPanel />
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            <GameTable year={currentYear} />
            <PlayerRadar />
          </div>
        </div>
      );
    }

    if (page === "simulator") {
      return <AIStorySimulator />;
    }

    if (page === "radar") {
      return (
        <div className="content-area">
          <div className="card">
            <PlayerRadar />
          </div>
        </div>
      );
    }

    if (page === "profile") {
      return (
        <div className="content-area">
          <UserProfileCard />
        </div>
      );
    }

    if (page === "history") {
      return <HistoryPage />;
    }

    return (
      <div className="content-area">
        <p>Unknown page.</p>
      </div>
    );
  };

  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          marginBottom: "2rem",
          borderBottom: "2px solid #eee",
          paddingBottom: "1rem",
        }}
      >
        <h1 style={{ color: "#003594", margin: 0 }}>LoneStar Analytics 🏈</h1>
        <p style={{ color: "#666", marginTop: "0.5rem" }}>
          Dallas Cowboys Real-time Dashboard
        </p>
      </header>

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


