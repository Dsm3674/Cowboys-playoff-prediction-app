// frontend/src/components/SeasonPathExplorer.jsx

function SeasonPathExplorer() {
  const [year] = React.useState(new Date().getFullYear());
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // k=15 paths, chaos=0
    window.api.getPaths("DAL", year, 15, 0)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="card">Calculating Monte Carlo Paths...</div>;
  if (!data) return <div className="card">No path data available.</div>;

  // SAFETY CHECK: Ensure arrays exist before mapping
  const remainingGames = data.remainingGames || [];
  const paths = data.paths || [];

  return (
    <div className="content-area">
      <div className="card">
        <h2 style={{marginTop:0}}>Season Path Explorer</h2>
        <p>Visualizing the {paths.length} most likely remaining season outcomes based on current win probabilities.</p>

        <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
          <table style={{ minWidth: '600px', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Probability</th>
                <th>Final Wins</th>
                {remainingGames.map(g => (
                  <th key={g.idx} style={{ textAlign: 'center' }}>
                    <div style={{fontSize:'0.7rem', color:'#aaa'}}>{g.date ? g.date.slice(5,10) : ''}</div>
                    vs {g.opp}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paths.map((path, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 'bold', color: '#003594' }}>
                    {(path.probability * 100).toFixed(1)}%
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    +{path.winsAdded}
                  </td>
                  {(path.outcomes || []).map((o, idx) => (
                    <td key={idx} style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        background: o.result === 'W' ? '#dcfce7' : '#fee2e2',
                        color: o.result === 'W' ? '#166534' : '#991b1b'
                      }}>
                        {o.result}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.SeasonPathExplorer = SeasonPathExplorer;
