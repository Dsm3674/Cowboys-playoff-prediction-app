// frontend/src/components/LiveWinProbTool.jsx

function LiveWinProbTool() {
  const [inputs, setInputs] = React.useState({
    scoreDiff: 0,
    secondsRemaining: 900, // 15 mins (start of 4th)
    yardLine: 50,
    offenseTimeouts: 3,
    defenseTimeouts: 3,
    down: 1,
    yardsToGo: 10,
    possession: "team"
  });

  const [prob, setProb] = React.useState(null);

  const handleChange = (field, val) => {
    setInputs(prev => ({ ...prev, [field]: val }));
  };

  const calculate = () => {
    window.api.getWinProb(inputs)
      .then(res => setProb(res.winProbability))
      .catch(console.error);
  };

  return (
    <div className="card">
      <h2 style={{marginTop:0}}>Live Win Probability Calculator</h2>
      <p style={{fontSize:'0.9rem', color:'#666'}}>
        Input current game state to calculate Dallas' win probability in real-time.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        
        <div className="form-group">
          <label>Score Diff (Positive = Winning)</label>
          <input type="number" value={inputs.scoreDiff} onChange={e => handleChange('scoreDiff', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Seconds Left</label>
          <input type="number" value={inputs.secondsRemaining} onChange={e => handleChange('secondsRemaining', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Ball On (0-100)</label>
          <input type="number" value={inputs.yardLine} onChange={e => handleChange('yardLine', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Down (1-4)</label>
          <select value={inputs.down} onChange={e => handleChange('down', Number(e.target.value))}>
            <option value="1">1st</option>
            <option value="2">2nd</option>
            <option value="3">3rd</option>
            <option value="4">4th</option>
          </select>
        </div>
      </div>

      <button className="btn-primary" onClick={calculate} style={{ marginTop: '1rem' }}>
        Calculate Odds
      </button>

      {prob !== null && (
        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1.5rem', 
          background: '#f0f9ff', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#003594' }}>Win Probability</div>
          <div style={{ fontSize: '3rem', fontWeight: '900', color: '#003594' }}>
            {(prob * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

window.LiveWinProbTool = LiveWinProbTool;
