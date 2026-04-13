const { useEffect, useMemo, useState } = React;

function LeagueForecastPage({ year = new Date().getFullYear() }) {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    window.api.getLeagueForecast(year)
      .then((data) => {
        if (cancelled) return;
        if (!data || !Array.isArray(data.forecast)) throw new Error("Forecast data is unavailable.");
        setForecast(data.forecast);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load the league forecast.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div>
        <div className="data-grid auto-fit" style={{ marginBottom: "1.25rem" }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-block metric-tile" style={{ height: "90px" }}></div>)}
        </div>
        <div className="skeleton-block" style={{ height: "250px", borderRadius: "8px" }}></div>
      </div>
    );
  }

  if (error) return <div className="card" style={{ borderLeft: "3px solid var(--accent-danger)" }}><p className="text-muted">{error}</p></div>;

  const top5 = forecast.slice(0, 5);
  const leader = forecast[0];

  return (
    <div>
      {leader && (
        <div className="key-insight" style={{ marginBottom: "1.5rem" }}>
          {leader.code} leads projections with {leader.projectedWins} projected wins ({leader.projectedWinRate}% win rate)
        </div>
      )}

      <div className="section-label">Top Projected Teams</div>
      <div className="data-grid auto-fit" style={{ marginBottom: "2rem" }}>
        {top5.map((team, i) => (
          <div key={team.code} className="metric-tile">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="metric-value accent">{team.projectedWins}</div>
                <div className="metric-label">#{i + 1} {team.code}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--fg-dim)", fontWeight: 600 }}>
                  {team.record.wins}-{team.record.losses}-{team.record.ties}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                  {team.projectedWinRate}% proj
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">Full Forecast Leaderboard</div>
      <div className="data-table-wrap">
        <table style={{ minWidth: "700px" }}>
          <thead>
            <tr>
              <th>Team</th>
              <th>Conf</th>
              <th>Div</th>
              <th>Current Win %</th>
              <th>Proj Wins</th>
              <th>Remaining</th>
              <th>Proj Score</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((team) => (
              <tr key={team.code}>
                <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                <td>{team.conference}</td>
                <td>{team.division}</td>
                <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                <td className="text-accent" style={{ fontWeight: 600 }}>{team.projectedWins}</td>
                <td>{team.remainingGames}</td>
                <td>{team.projectionScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.LeagueForecastPage = LeagueForecastPage;
