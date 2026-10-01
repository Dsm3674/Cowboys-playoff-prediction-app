import React from "react";
import { api } from "../api";

// frontend/src/components/SeasonPathExplorer.jsx

function SeasonPathExplorer({ year, team = "DAL" }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // k=15 paths, chaos=0
    setLoading(true);
    api.getPaths(team, year, 15, 0)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, team]);

  if (loading) return <div className="card">Calculating Monte Carlo Paths...</div>;
  if (!data) return <div className="card">No path data available.</div>;

  // SAFETY CHECK: Ensure arrays exist before mapping
  const remainingGames = data.remainingGames || [];
  const paths = data.paths || [];

  return (
    <div className="content-area">
      <div className="card">
        <h2 style={{marginTop:0}}>{team} Season Path Explorer</h2>
        <p>
          The {paths.length} most likely ways {team}'s remaining games go, from the model's
          game-by-game odds (betting line where one exists, otherwise Elo). Playoff odds use
          {team}'s win-total curve from the league simulation.
        </p>
        {paths.length === 0 && remainingGames.length > 0 && (
          <p className="text-muted">Too many games left to list every path; check back later in the season.</p>
        )}

        <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
          <table style={{ minWidth: '600px', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Probability</th>
                <th>Final Wins</th>
                <th>Playoff Odds</th>
                {remainingGames.map(g => (
                  <th key={g.idx} style={{ textAlign: 'center' }}>
                    <div style={{fontSize:'0.7rem', color:'#aaa'}}>{g.date ? g.date.slice(5,10) : ''}</div>
                    {g.isHome ? "vs" : "@"} {g.opp}
                    <div style={{fontSize:'0.7rem', color:'#aaa'}}>{Math.round(g.pWin * 100)}%</div>
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
                    {path.finalWins ?? `+${path.winsAdded}`}
                  </td>
                  <td>
                    {path.playoffProbability != null ? `${(path.playoffProbability * 100).toFixed(0)}%` : "—"}
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

export default SeasonPathExplorer;
