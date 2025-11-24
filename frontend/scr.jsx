const { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } = window.Recharts;

function App() {
  // Feature 6: Theme Toggler
  const [theme, setTheme] = React.useState('cowboys');
  const [activeTab, setActiveTab] = React.useState('dashboard');

  React.useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'simulator': return <Simulator />;
      case 'players': return <PlayerIntel />;
      case 'profile': return <UserProfile />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <nav className="main-nav">
        <div className="nav-brand">🏈 LoneStar Analytics</div>
        <div className="nav-links">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={activeTab === 'simulator' ? 'active' : ''} onClick={() => setActiveTab('simulator')}>AI Simulator</button>
          <button className={activeTab === 'players' ? 'active' : ''} onClick={() => setActiveTab('players')}>Player Intel</button>
          <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>Profile</button>
        </div>
        <div className="theme-selector">
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="cowboys">🤠 Classic</option>
            <option value="dark">🌑 Night Mode</option>
            <option value="retro">📺 Retro 90s</option>
          </select>
        </div>
      </nav>
      <main className="content-area">
        {renderContent()}
      </main>
    </div>
  );
}

// --- TAB 1: DASHBOARD (Original Features + Real Time) ---
function Dashboard() {
  const [prediction, setPrediction] = React.useState(null);
  const year = new Date().getFullYear();

  React.useEffect(() => {
    window.getCurrentPrediction().then(res => setPrediction(res.prediction));
  }, []);

  return (
    <div className="grid-layout">
      <div className="col-left">
        <RecordCard year={year} />
        {prediction && (
           <div className="card prediction-card">
             <h3>Live Playoff Odds</h3>
             <div className="stat-big">{(prediction.playoff_probability || 72.5)}%</div>
             <p>Super Bowl Chance: {prediction.superbowl_probability || 8.2}%</p>
             <div className="confidence-pill">Confidence: {prediction.confidence_score}%</div>
           </div>
        )}
      </div>
      <div className="col-right">
        <GameTable year={year} />
      </div>
    </div>
  );
}

// --- TAB 2: SIMULATOR (Features 2, 8, 9, 12) ---
function Simulator() {
  const [model, setModel] = React.useState('RandomForest');
  const [scenario, setScenario] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/simulation/run', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ modelType: model, scenario })
      });
      const data = await res.json();
      setResult(data.results);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="simulator-wrapper">
      <div className="card controls">
        <h2>🤖 AI Engine Configuration</h2>
        <div className="form-group">
          <label>Machine Learning Model (Feature 9)</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="RandomForest">Random Forest (Balanced)</option>
            <option value="LSTM">LSTM (Trend Sensitive)</option>
            <option value="Elo">Elo Rating (Conservative)</option>
          </select>
        </div>
        <div className="form-group">
          <label>"What If?" Scenario (Feature 2)</label>
          <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
            <option value="">No External Stimulus</option>
            <option value="injury_qb">Major Injury: Quarterback</option>
            <option value="weather_snow">Heavy Snow Game</option>
            <option value="easy_schedule">Strength of Schedule: Easy</option>
          </select>
        </div>
        <button className="btn-primary" onClick={runSimulation} disabled={loading}>
          {loading ? 'Crunching Numbers...' : '▶ Run Simulation'}
        </button>
      </div>

      {result && (
        <div className="card results fade-in">
          <h3>Simulation Outcome</h3>
          <div className="result-grid">
            <div className="result-item">
              <span>Win Probability</span>
              <strong>{result.winProbability}%</strong>
            </div>
            <div className="result-item">
              <span>Projected Record</span>
              <strong>{result.projectedRecord}</strong>
            </div>
          </div>
          <div className="story-box">
            <strong>AI Storyline (Feature 12):</strong>
            <p>{result.story}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- TAB 3: PLAYER INTEL (Features 1, 5, 11) ---
function PlayerIntel() {
  // Mock Data for Radar Chart
  const radarData = [
    { subject: 'Passing', A: 120, fullMark: 150 },
    { subject: 'IQ', A: 98, fullMark: 150 },
    { subject: 'Clutch', A: 86, fullMark: 150 },
    { subject: 'Health', A: 99, fullMark: 150 },
    { subject: 'Mobility', A: 85, fullMark: 150 },
  ];

  return (
    <div className="player-intel">
      <h2>Player Impact & Visualization</h2>
      <div className="grid-layout">
        <div className="card">
          <h3>Dak Prescott - Skill Radar (Feature 5)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis />
                <Radar name="Dak" dataKey="A" stroke="#003594" fill="#003594" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Player Score Impact Index (PSII) (Feature 11)</h3>
          <ul className="stat-list">
             <li>
               <span>Dak Prescott</span>
               <span className="stat-val high">+12.4% Win Prob</span>
             </li>
             <li>
               <span>CeeDee Lamb</span>
               <span className="stat-val medium">+8.2% Win Prob</span>
             </li>
             <li>
               <span>Micah Parsons</span>
               <span className="stat-val high">+10.1% Win Prob</span>
             </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- TAB 4: PROFILE (Feature 4 & 10) ---
function UserProfile() {
  return (
    <div className="profile-wrapper">
      <div className="card login-box">
        <h2>User Login</h2>
        <input type="text" placeholder="Username" />
        <input type="password" placeholder="Password" />
        <button className="btn-primary">Login</button>
        <p><small>Login to save predictions and set alerts.</small></p>
      </div>
      
      <div className="card community">
        <h3>Community Engagement (Feature 10)</h3>
        <p>What is your prediction for next week?</p>
        <div className="vote-buttons">
            <button className="btn-outline">Cowboys Win</button>
            <button className="btn-outline">Cowboys Lose</button>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
