// 1. DESTUCTURE RECHARTS (Required for CDN usage)
const { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar 
} = Recharts;

// =========================================
// COMPONENT: RecordCard
// =========================================
function RecordCard({ year }) {
  const [record, setRecord] = React.useState({ wins: 0, losses: 0, ties: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    window.getCowboysRecord(year)
      .then(data => setRecord(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="p-4">Loading record...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div style={{ 
      background: "white", 
      padding: "1.5rem", 
      borderRadius: "10px", 
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      textAlign: "center"
    }}>
      <h3 style={{ margin: "0 0 0.5rem 0", color: "#666" }}>{year} Regular Season</h3>
      <div style={{ fontSize: "3.5rem", fontWeight: "800", color: "#003594", lineHeight: "1" }}>
        {record.wins}-{record.losses}
        {record.ties > 0 && <span>-{record.ties}</span>}
      </div>
      <p style={{ margin: "0.5rem 0 0 0", fontWeight: "bold", color: "#888" }}>
        Win Pct: {record.winPct ? (record.winPct * 100).toFixed(1) : "0.0"}%
      </p>
    </div>
  );
}

// =========================================
// COMPONENT: GameTable
// =========================================
function GameTable({ year }) {
  const [games, setGames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    window.getCowboysSchedule(year)
      .then(data => setGames(data.games || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div>Loading schedule...</div>;

  return (
    <div style={{ background: "white", padding: "1rem", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <h3 style={{ marginTop: 0 }}>Season Schedule</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
          <thead>
            <tr style={{ background: "#f4f4f4" }}>
              <th style={{ padding: "10px", textAlign: "left" }}>Wk</th>
              <th style={{ padding: "10px", textAlign: "left" }}>Date</th>
              <th style={{ padding: "10px", textAlign: "left" }}>Opponent</th>
              <th style={{ padding: "10px", textAlign: "center" }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g, idx) => {
              const isHome = g.homeTeam.abbreviation === 'DAL';
              const opponent = isHome ? g.awayTeam : g.homeTeam;
              const isWin = (isHome && g.homeScore > g.awayScore) || (!isHome && g.awayScore > g.homeScore);
              
              return (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>{g.week}</td>
                  <td style={{ padding: "10px" }}>{new Date(g.date).toLocaleDateString()}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ color: isHome ? "black" : "#666" }}>{isHome ? "vs " : "@ "}</span>
                    <strong>{opponent.displayName || opponent.name}</strong>
                  </td>
                  <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold", color: isWin ? "green" : "red" }}>
                    {g.completed ? `${g.awayScore} - ${g.homeScore}` : g.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================
// COMPONENT: PredictionPanel
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
            background: "#003594", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer"
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
// RENDER APPLICATION
// =========================================
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
