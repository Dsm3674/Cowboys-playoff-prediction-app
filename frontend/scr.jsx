function App() {
  const yearNow = new Date().getFullYear();
  const [year, setYear] = React.useState(yearNow);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [lastUpdate, setLastUpdate] = React.useState(new Date());

  // Auto-refresh every 2 minutes
  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing data...');
      setRefreshKey(prev => prev + 1);
      setLastUpdate(new Date());
    }, 2 * 60 * 1000); // 2 minutes in milliseconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Cowboys Playoff Prediction App</h1>
      <p>Live record and every game</p>
      
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <label>
          <strong>Season:</strong>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ marginLeft: "0.5rem", padding: "0.25rem", width: "80px" }}
          />
        </label>
        
        <button 
          onClick={() => {
            setRefreshKey(prev => prev + 1);
            setLastUpdate(new Date());
          }}
          style={{ 
            padding: "0.5rem 1rem", 
            background: "#003594", 
            color: "white", 
            border: "none", 
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          🔄 Refresh Now
        </button>
        
        <small style={{ color: "#666" }}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </small>
      </div>

      <RecordCard year={year} key={`record-${year}-${refreshKey}`} />
      <GameTable year={year} key={`games-${year}-${refreshKey}`} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
