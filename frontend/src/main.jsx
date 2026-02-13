// 1. Define Helper Components (Skeleton, Confidence) first
function SkeletonCard({ title }) {
  return (
    <div style={{ background: "#f3f4f6", padding: "1rem", borderRadius: "8px" }}>
      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{title}</div>
      <div style={{ height: "22px", width: "55%", background: "#e5e7eb", borderRadius: "6px", marginTop: "10px" }} />
      <div style={{ height: "8px", width: "90%", background: "#e5e7eb", borderRadius: "6px", marginTop: "12px" }} />
      <div style={{ height: "8px", width: "80%", background: "#e5e7eb", borderRadius: "6px", marginTop: "8px" }} />
    </div>
  );
}

function ConfidenceMeter({ value }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div style={{ height: "10px", background: "#e5e7eb", borderRadius: "999px", overflow: "hidden" }}>
        <div
          style={{
            width: pct + "%",
            height: "100%",
            background: "#003594",
            transition: "width 400ms ease",
          }}
        />
      </div>
      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
        Confidence meter: {pct.toFixed(0)}%
      </div>
    </div>
  );
}

// 2. The Main PredictionPanel Component (From your original file)
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

  const saveToHistory = (prediction) => {
    try {
      const key = getHistoryKey();
      if (!key) return;

      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      const safeExisting = Array.isArray(existing) ? existing : [];

      const entry = {
        ts: new Date().toISOString(),
        playoffs: prediction.playoff_probability,
        superBowl: prediction.superbowl_probability,
      };

      const updated = [entry, ...safeExisting].slice(0, 10);
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
        if (data && data.success && data.prediction) {
          setPred(data.prediction);
          saveToHistory(data.prediction);
        } else {
          setError("Prediction service returned no result");
        }
      })
      .catch((err) => setError(err?.message || "Request failed"))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    if (prefs.autorun && !pred && !loading) {
      fetchPrediction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.autorun]);

  const clearHistory = () => {
    const ok = window.confirm("Clear your saved prediction history for this username?");
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
    return "Prayer";
  };

  const shareText = pred
    ? `LoneStar Analytics — Cowboys odds: Playoffs ${(pred.playoff_probability * 100).toFixed(
        1
      )}%, Super Bowl ${(pred.superbowl_probability * 100).toFixed(1)}%`
    : "";

  const copyShare = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = shareText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {}
    }
  };

  return (
    <div className="card" style={{ background: "white" }}>
      {/* Header Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">Monte Carlo Engine</div>
          <h3 style={{ margin: 0 }}>Playoff Odds (AI Model)</h3>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* autorun toggle */}
          <label style={{ fontSize: "0.8rem", color: "#374151", display: "flex", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={!!prefs.autorun}
              onChange={(e) => savePrefs({ ...prefs, autorun: e.target.checked })}
            />
            Auto-run
          </label>

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
      </div>

      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 0 }}>
        Under the hood: we take real scoring data, estimate team strength, and then simulate
        thousands of seasons to estimate how often a playoff run appears. It’s not a crystal
        ball, but it’s a fun stress test.
      </p>

      {/* Error */}
      {error && <p style={{ color: "#d00", marginTop: 0 }}>{error}</p>}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem" }}>
          <SkeletonCard title="Make Playoffs" />
          <SkeletonCard title="Super Bowl" />
        </div>
      )}

      {/* No prediction yet */}
      {!pred && !loading ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ fontStyle: "italic", color: "#666", marginBottom: "0.25rem" }}>
            Run the simulation to see current playoff and Super Bowl odds.
          </p>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 0 }}>
            Tip: turn on <strong>Auto-run</strong> if you always want fresh odds when you open the dashboard.
          </p>
        </div>
      ) : null}

      {/* Prediction display */}
      {pred && !loading && (
        <>
          <div
            className="pulse-glow"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginTop: "0.75rem",
            }}
          >
            <div style={{ background: "#f0f9ff", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ color: "#555" }}>Make Playoffs</div>
              <div style={{ fontSize: "1.6rem", color: "#003594", fontWeight: "bold" }}>
                {(pred.playoff_probability * 100).toFixed(1)}%
              </div>

              <ConfidenceMeter value={pred.playoff_probability} />
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.35rem" }}>
                {confidenceLabel(pred.playoff_probability)}
              </div>
            </div>

            <div style={{ background: "#fff0f0", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ color: "#555" }}>Super Bowl</div>
              <div style={{ fontSize: "1.6rem", color: "#d20a0a", fontWeight: "bold" }}>
                {(pred.superbowl_probability * 100).toFixed(1)}%
              </div>

              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.6rem" }}>
                Championship odds are always smaller — that’s normal.
              </div>
            </div>
          </div>

          {/* trend row */}
          {(trendPlayoffs !== null || trendSB !== null) && (
            <div style={{ marginTop: "0.9rem", fontSize: "0.85rem", color: "#374151" }}>
              <strong>Trend vs last run:</strong>{" "}
              {trendPlayoffs !== null ? (
                <span style={{ marginRight: "0.75rem" }}>
                  Playoffs{" "}
                  <span style={{ fontWeight: 700 }}>
                    {trendPlayoffs >= 0 ? "+" : ""}
                    {trendPlayoffs.toFixed(1)}%
                  </span>
                </span>
              ) : null}
              {trendSB !== null ? (
                <span>
                  SB{" "}
                  <span style={{ fontWeight: 700 }}>
                    {trendSB >= 0 ? "+" : ""}
                    {trendSB.toFixed(1)}%
                  </span>
                </span>
              ) : null}
            </div>
          )}

          {/* action buttons */}
          <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={copyShare}
              style={{
                border: "1px solid #111827",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "white",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {copied ? "Copied ✅" : "Copy share text"}
            </button>

            <button
              onClick={downloadCSV}
              disabled={history.length === 0}
              style={{
                border: "1px solid #111827",
                padding: "8px 12px",
                borderRadius: "6px",
                background: history.length ? "white" : "#f3f4f6",
                cursor: history.length ? "pointer" : "not-allowed",
                fontSize: "0.85rem",
                fontWeight: 600,
                opacity: history.length ? 1 : 0.6,
              }}
            >
              Download CSV
            </button>

            <button
              onClick={clearHistory}
              disabled={history.length === 0}
              style={{
                border: "1px solid #dc2626",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "white",
                color: "#dc2626",
                cursor: history.length ? "pointer" : "not-allowed",
                fontSize: "0.85rem",
                fontWeight: 700,
                opacity: history.length ? 1 : 0.55,
              }}
            >
              Clear history
            </button>
          </div>
        </>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ marginBottom: "0.5rem" }}>Your Prediction History</h4>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 0 }}>
            Saved locally to your browser and tied to your current username. Change your profile name to track
            different “what if” universes.
          </p>

          <ul style={{ listStyle: "none", paddingLeft: 0, fontSize: "0.85rem", margin: 0 }}>
            {history.map((h, idx) => (
              <li key={idx} style={{ padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
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

// -------------------------------------------------------------
// 3. MAIN APP ROUTING & MOUNTING LOGIC
// -------------------------------------------------------------

// Safety check for components loaded via other script tags in index.html
// If they are missing or failed to load, we use a simple placeholder so the app doesn't crash.
const SafeComponent = (name, Component) => {
  if (Component) return Component;
  return () => (
    <div className="card">
      <h3>{name} Unavailable</h3>
      <p>Component script not found or failed to load.</p>
    </div>
  );
};

// --- Dashboard View ---
function Dashboard() {
  const year = new Date().getFullYear();
  
  // Use window.Component or fallback
  const TSICardSafe = SafeComponent('TSI Card', window.TSICard);
  const MustWinSafe = SafeComponent('Must Win Card', window.MustWinCard);
  const LiveProbSafe = SafeComponent('Live Prob Tool', window.LiveWinProbTool);

  return (
    <div>
      <h1 className="hero-title">
        LoneStar <span>Analytics</span>
      </h1>
      <div className="hero-kicker">Dallas Cowboys Advanced Data Hub</div>
      
      <div className="grid-layout">
        <div>
           {/* Profile & Record */}
           <UserProfileCard />
           <RecordCard year={year} />
           
           {/* Advanced Stats Column */}
           <TSICardSafe year={year} />
           <MustWinSafe year={year} />
        </div>
        
        <div>
           {/* Main Monte Carlo Engine */}
           <PredictionPanel />
           
           {/* Live Tools */}
           <div style={{marginTop: '2rem'}}>
             <LiveProbSafe />
           </div>
           
           {/* Schedule */}
           <div style={{marginTop: '2rem'}}>
             <GameTable year={year} />
           </div>
        </div>
      </div>
    </div>
  );
}

// --- Main App Component ---
function App() {
  // Simple state-based router
  const [currentPage, setCurrentPage] = React.useState('dashboard');

  // Listen for navigation events
  React.useEffect(() => {
    // Expose setPage globally so index.html onclicks work
    window.setPage = (page) => {
      setCurrentPage(page);
      
      // Update browser URL hash (optional, just for feel)
      window.location.hash = page;

      // Update active state in Navbar (vanilla JS for performance)
      document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('active');
        if(el.dataset.page === page) el.classList.add('active');
      });

      // Update Debug Bar
      const debugEl = document.getElementById("route-indicator");
      if(debugEl) debugEl.textContent = `Route: ${page}`;
    };

    // Check initial hash
    const initialHash = window.location.hash.replace('#', '');
    if(initialHash) window.setPage(initialHash);
    else window.setPage('dashboard');

  }, []);

  // Safe References for pages
  const SeasonPathSafe = SafeComponent('Season Paths', window.SeasonPathExplorer);
  const LiveProbSafe = SafeComponent('Live Prob Tool', window.LiveWinProbTool);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'simulator': return <AIStorySimulator />;
      case 'radar':     return <PlayerRadar />;
      case 'paths':     return <SeasonPathSafe />;
      case 'liveprob':  return <LiveProbSafe />;
      case 'profile':   return <UserProfileCard />;
      case 'history':   return <HistoryPage />;
      default:          return <Dashboard />;
    }
  };

  return (
    <div className="content-area fade-in">
      {renderPage()}
      
      {/* Global Footer */}
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
            <p className="site-footer__tiny">v2.0.4 (Beta)</p>
          </div>
        </div>
        <div className="site-footer__bottom">
          <span>&copy; {new Date().getFullYear()} LoneStar Analytics</span>
        </div>
      </footer>
    </div>
  );
}

// --- MOUNT THE APP ---
const rootElement = document.getElementById('root');
if(rootElement) {
  ReactDOM.render(<App />, rootElement);
}


