

function SkeletonCard({ title }) {
  return (
    <div className="card card-dense">
      <div className="text-small text-muted">{title}</div>
      <div style={{ height: "22px", background: "#e5e7eb", borderRadius: "6px", marginTop: "10px" }} />
      <div style={{ height: "8px", background: "#e5e7eb", borderRadius: "6px", marginTop: "12px" }} />
      <div style={{ height: "8px", background: "#e5e7eb", borderRadius: "6px", marginTop: "8px" }} />
    </div>
  );
}

function ConfidenceMeter({ value }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: pct + "%" }}
        />
      </div>
      <div className="progress-label">
        Confidence meter: {pct.toFixed(0)}%
      </div>
    </div>
  );
}

// 2. PREDICTION PANEL
// ================================================================

function PredictionPanel() {
  const [pred, setPred] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [copied, setCopied] = React.useState(false);

  const getProfile = () => {
    try {
      return JSON.parse(localStorage.getItem("ls_profile") || "null");
    } catch {
      return null;
    }
  };

  const getHistoryKey = () => {
    const profile = getProfile();
    if (!profile || !profile.username) return null;
    return `ls_predictions_${profile.username}`;
  };

  const getPrefsKey = () => {
    const profile = getProfile();
    if (!profile || !profile.username) return null;
    return `ls_predictionprefs_${profile.username}`;
  };

  const loadHistory = () => {
    try {
      const key = getHistoryKey();
      if (!key) {
        setHistory([]);
        return;
      }
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      setHistory(Array.isArray(saved) ? saved : []);
    } catch (e) {
      console.warn("PredictionPanel: failed to load history", e);
      setHistory([]);
    }
  };

  const loadPrefs = () => {
    try {
      const key = getPrefsKey();
      if (!key) return { autorun: false };
      const prefs = JSON.parse(localStorage.getItem(key) || "null");
      return prefs && typeof prefs === "object" ? prefs : { autorun: false };
    } catch {
      return { autorun: false };
    }
  };

  const [prefs, setPrefs] = React.useState(() => loadPrefs());

  const savePrefs = (nextPrefs) => {
    setPrefs(nextPrefs);
    try {
      const key = getPrefsKey();
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(nextPrefs));
    } catch {}
  };

  React.useEffect(() => {
    loadHistory();
  }, []);

  React.useEffect(() => {
    if (prefs.autorun) {
      fetchPrediction();
    }
  }, [prefs.autorun]);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.getPrediction();
      if (result && typeof result === "object") {
        setPred(result);
        const historyEntry = {
          ts: new Date().toISOString(),
          playoffs: result.playoff_probability || 0,
          superBowl: result.superbowl_probability || 0,
        };
        const key = getHistoryKey();
        if (key) {
          const old = JSON.parse(localStorage.getItem(key) || "[]");
          const updated = [historyEntry, ...(Array.isArray(old) ? old : [])].slice(0, 50);
          localStorage.setItem(key, JSON.stringify(updated));
          setHistory(updated);
        }
      }
    } catch (e) {
      setError(`Error: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const copyShare = () => {
    if (!pred) return;
    const text = `LoneStar Analytics: Cowboys playoff odds ${(
      pred.playoff_probability * 100
    ).toFixed(1)}%, Super Bowl ${(pred.superbowl_probability * 100).toFixed(1)}%`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clearHistory = () => {
    const ok = window.confirm(
      "Clear your saved prediction history for this username?"
    );
    if (!ok) return;

    try {
      const key = getHistoryKey();
      if (!key) return;
      localStorage.removeItem(key);
      setHistory([]);
    } catch {}
  };

  const downloadCSV = () => {
    if (!history.length) return;

    const rows = [
      ["timestamp_iso", "playoff_probability", "superbowl_probability"],
      ...history.map((h) => [h.ts, h.playoffs, h.superBowl]),
    ];

    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "lonestar_prediction_history.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const lastEntry = history.length > 0 ? history[0] : null;
  const prevEntry = history.length > 1 ? history[1] : null;

  const trendPlayoffs =
    prevEntry && lastEntry ? (lastEntry.playoffs - prevEntry.playoffs) * 100 : null;

  const trendSB =
    prevEntry && lastEntry ? (lastEntry.superBowl - prevEntry.superBowl) * 100 : null;

  const confidenceLabel = (p) => {
    if (p >= 0.75) return "High confidence";
    if (p >= 0.55) return "Solid";
    if (p >= 0.40) return "Coin flip zone";
    if (p >= 0.25) return "Long shot";
    return "Unlikely";
  };

  return (
    <div className="card">
      <h3>Monte Carlo Playoff Simulator</h3>

      <div style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={!!prefs.autorun}
            onChange={(e) => savePrefs({ ...prefs, autorun: e.target.checked })}
          />
          Auto-run on page load
        </label>

        <button
          onClick={fetchPrediction}
          disabled={loading}
          className={`btn-primary ${loading ? "opacity-50" : ""}`}
          style={{ marginTop: "1rem", width: "100%" }}
        >
          {loading ? "Running..." : "Run Simulation"}
        </button>
      </div>

      <p className="text-small text-muted">
        We simulate thousands of seasons using real scoring data and team strength estimates to predict playoff odds.
      </p>

      {error && <p style={{ color: "var(--error)", marginTop: "1rem" }}>{error}</p>}

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <SkeletonCard title="Make Playoffs" />
          <SkeletonCard title="Super Bowl" />
        </div>
      )}

      {!pred && !loading && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontStyle: "italic", color: "#666", marginBottom: "0.25rem" }}>
            Run the simulation to see current playoff odds.
          </p>
        </div>
      )}

      {pred && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
            <div className="stat-box primary">
              <div className="stat-label">Make Playoffs</div>
              <div className="stat-value">{(pred.playoff_probability * 100).toFixed(1)}%</div>
              <ConfidenceMeter value={pred.playoff_probability} />
              <div className="text-small text-muted" style={{ marginTop: "0.5rem" }}>
                {confidenceLabel(pred.playoff_probability)}
              </div>
            </div>

            <div className="stat-box danger">
              <div className="stat-label">Super Bowl</div>
              <div className="stat-value" style={{ color: "var(--accent)" }}>
                {(pred.superbowl_probability * 100).toFixed(1)}%
              </div>
              <div className="text-small text-muted" style={{ marginTop: "0.75rem" }}>
                Championship odds are always smaller — that's normal.
              </div>
            </div>
          </div>

          {(trendPlayoffs !== null || trendSB !== null) && (
            <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--slate-700)" }}>
              <strong>Trend vs last run:</strong>{" "}
              {trendPlayoffs !== null && (
                <span style={{ marginRight: "0.75rem" }}>
                  Playoffs{" "}
                  <span style={{ fontWeight: 700 }}>
                    {trendPlayoffs >= 0 ? "+" : ""}
                    {trendPlayoffs.toFixed(1)}%
                  </span>
                </span>
              )}
              {trendSB !== null && (
                <span>
                  SB{" "}
                  <span style={{ fontWeight: 700 }}>
                    {trendSB >= 0 ? "+" : ""}
                    {trendSB.toFixed(1)}%
                  </span>
                </span>
              )}
            </div>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={copyShare}
              className="btn-secondary btn-small"
            >
              {copied ? "Copied ✅" : "Copy share text"}
            </button>

            <button
              onClick={downloadCSV}
              disabled={history.length === 0}
              className="btn-secondary btn-small"
              style={{ opacity: history.length ? 1 : 0.6 }}
            >
              Download CSV
            </button>

            <button
              onClick={clearHistory}
              disabled={history.length === 0}
              className="btn-danger btn-small"
              style={{ opacity: history.length ? 1 : 0.55 }}
            >
              Clear history
            </button>
          </div>
        </>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h4>Your Prediction History</h4>
          <p className="text-small text-muted">
            Saved locally to your browser and tied to your current username.
          </p>

          <ul style={{ listStyle: "none", paddingLeft: 0, fontSize: "0.85rem" }}>
            {history.map((h, idx) => (
              <li key={idx} style={{ padding: "6px 0", borderBottom: "1px solid var(--slate-200)" }}>
                <strong>
                  {new Date(h.ts).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                {": "}
                Playoffs {(h.playoffs * 100).toFixed(1)}%, SB {(h.superBowl * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 3. DASHBOARD
// ================================================================

function Dashboard() {
  const year = new Date().getFullYear();

  const TSICardSafe = SafeComponent("TSI Card", window.TSICard);
  const MustWinSafe = SafeComponent("Must Win Card", window.MustWinCard);
  const LiveProbSafe = SafeComponent("Live Prob Tool", window.LiveWinProbTool);

  return (
    <div>
      <h1 className="hero-title">
        LoneStar <span>Analytics</span>
      </h1>
      <div className="hero-kicker">Dallas Cowboys Advanced Data Hub</div>

      <div className="grid-layout">
        <div>
          <UserProfileCard />
          <RecordCard year={year} />
          <TSICardSafe year={year} />
          <MustWinSafe year={year} />
        </div>

        <div>
          <PredictionPanel />
          <div style={{ marginTop: "2rem" }}>
            <LiveProbSafe />
          </div>
          <div style={{ marginTop: "2rem" }}>
            <GameTable year={year} />
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. SAFE COMPONENT WRAPPER
// ================================================================

const SafeComponent = (name, Component) => {
  if (Component) return Component;
  return () => (
    <div className="card">
      <h3>{name} Unavailable</h3>
      <p>Component script not found or failed to load.</p>
    </div>
  );
};

// 5. MAIN APP WITH CONSOLIDATED NAVIGATION
// ================================================================

function App() {
  const [currentPage, setCurrentPage] = React.useState("dashboard");

  React.useEffect(() => {
    window.setPage = (page) => {
      setCurrentPage(page);
      window.location.hash = page;

      document.querySelectorAll(".nav-link").forEach((el) => {
        el.classList.remove("active");
        if (el.dataset.page === page) el.classList.add("active");
      });

      const debugEl = document.getElementById("route-indicator");
      if (debugEl) debugEl.textContent = `Route: ${page}`;
    };

    const initialHash = window.location.hash.replace("#", "");
    if (initialHash) window.setPage(initialHash);
    else window.setPage("dashboard");
  }, []);

  const SeasonPathSafe = SafeComponent("Season Paths", window.SeasonPathExplorer);
  const LiveProbSafe = SafeComponent("Live Prob Tool", window.LiveWinProbTool);
  const TimelineSafe = SafeComponent("Timeline", window.Timeline);
  const EventsAdminSafe = SafeComponent("Events Admin", window.EventsAdmin);

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "simulator":
        return <AIStorySimulator />;
      case "analytics":
        return (
          <div>
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
      case "rival":
        return <RivalTeamImpactPage />;
      case "clutch":
        return <ClutchIndex />;
      case "timeline":
        return <TimelineSafe />;
      case "paths":
        return <SeasonPathSafe />;
      case "liveprob":
        return <LiveProbSafe />;
      case "events":
        return <EventsAdminSafe />;
      case "profile":
        return <UserProfileCard />;
      case "history":
        return <HistoryPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="content-area fade-in">
      {renderPage()}

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__col">
            <h4>LoneStar Analytics</h4>
            <p>Built for the dedicated fan. We use probability, not punditry.</p>
          </div>
          <div className="site-footer__col">
            <h5>Data Sources</h5>
            <ul>
              <li>ESPN API</li>
              <li>Pro-Football-Ref</li>
            </ul>
          </div>
          <div className="site-footer__col">
            <h5>Version</h5>
            <p className="site-footer__tiny">v2.1.0 (Refactored)</p>
          </div>
        </div>
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


