// 1. DESTRUCTURE RECHARTS (Required for CDN usage)
const { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar 
} = Recharts;

// =========================================
// COMPONENT: PredictionPanel
// (RecordCard and GameTable already defined in separate files)
// =========================================
function PredictionPanel() {
  const [pred, setPred] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const fetchPrediction = () => {
    setLoading(true);
    window.generatePrediction()
      .then(data => {
        if(data.success) setPred(data.prediction);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ background: "white", padding: "1.5rem", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
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
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? "Running Sim..." : "Run Simulation"}
        </button>
      </div>

      {pred ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ padding: "10px", background: "#f0f9ff", borderRadius: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "0.9rem", color: "#555" }}>Make Playoffs</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#003594" }}>
              {(pred.playoff_probability * 100).toFixed(1)}%
            </div>
          </div>
          <div style={{ padding: "10px", background: "#fff0f0", borderRadius: "8px", textAlign: "center" }}>
            <div style={{ fontSize: "0.9rem", color: "#555" }}>Super Bowl</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#d50a0a" }}>
              {(pred.superbowl_probability * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      ) : (
        <p style={{ color: "#666", fontStyle: "italic" }}>Click 'Run Simulation' to view latest odds.</p>
      )}
    </div>
  );
}

// =========================================
// COMPONENT: App (Main Layout)
// =========================================
function App() {
  const currentYear = new Date().getFullYear();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      
      {/* HEADER */}
      <header style={{ marginBottom: "2rem", borderBottom: "2px solid #eee", paddingBottom: "1rem" }}>
        <h1 style={{ color: "#003594", margin: 0 }}>LoneStar Analytics 🏈</h1>
        <p style={{ color: "#666", margin: "5px 0 0 0" }}>Dallas Cowboys Real-time Dashboard</p>
      </header>

      {/* GRID LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <RecordCard year={currentYear} />
          <PredictionPanel />
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ flex: 2 }}>
          <GameTable year={currentYear} />
        </div>

      </div>
    </div>
  );
}

// =========================================
// RENDER APPLICATION - FIXED FOR REACT 17
// =========================================
ReactDOM.render(<App />, document.getElementById("root"));
