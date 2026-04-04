const { useEffect, useMemo, useState } = React;

function LeagueInsightsPage({ year = new Date().getFullYear() }) {
  const [standings, setStandings] = useState(null);
  const [divisionPower, setDivisionPower] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [playoffPulse, setPlayoffPulse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    Promise.allSettled([
      window.api.getStandings(year),
      window.api.getDivisionPower(year),
      window.api.getLeagueForecast(year),
      window.api.getPlayoffPulse(year)
    ])
      .then((results) => {
        const [standingsResult, divisionResult, forecastResult, pulseResult] = results;

        if (standingsResult.status === "fulfilled") {
          setStandings(standingsResult.value.standings);
        }
        if (divisionResult.status === "fulfilled") {
          setDivisionPower(divisionResult.value.divisions);
        }
        if (forecastResult.status === "fulfilled") {
          setForecast(forecastResult.value.forecast);
        }
        if (pulseResult.status === "fulfilled") {
          setPlayoffPulse(pulseResult.value.pulse);
        }

        const failed = results.filter((item) => item.status === "rejected");
        if (failed.length > 0) {
          setError("Some league insights could not be loaded. Refresh to retry.");
        }
      })
      .catch((err) => setError(err?.message || "Failed to load league insights."))
      .finally(() => setLoading(false));
  }, [year]);

  const topPlayoffTeams = useMemo(() => {
    if (!playoffPulse) return [];
    return [...playoffPulse].slice(0, 8);
  }, [playoffPulse]);

  const topForecastTeams = useMemo(() => {
    if (!forecast) return [];
    return [...forecast].slice(0, 8);
  }, [forecast]);

  const renderConferenceLeaders = () => {
    if (!standings) return null;

    return Object.entries(standings).map(([conference, divisions]) => (
      <div key={conference} className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>{conference} Leaders</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {Object.entries(divisions).map(([division, teams]) => (
            <div key={division} style={{ padding: "1rem", borderRadius: "12px", background: "#f8fafc" }}>
              <h4 style={{ marginTop: 0 }}>{division}</h4>
              <ol style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {teams.slice(0, 3).map((team) => (
                  <li key={team.code} style={{ marginBottom: "0.5rem" }}>
                    <strong>{team.code}</strong> — {(team.record.winPct * 100).toFixed(1)}%
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="card">
        <h2>League Insights</h2>
        <p className="text-muted">Pulling together the latest league-wide analytics and projections for {year}...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>League Insights</h1>
        <p className="text-small text-muted">
          A consolidated executive view of the league, with division strength, forecasted leaders, and playoff pulse metrics all in one place.
        </p>
      </div>

      {error ? (
        <div className="card" style={{ borderLeft: "4px solid #dc2626", marginBottom: "1.5rem" }}>
          <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Top Forecasted Teams</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "700px" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Projected Wins</th>
                  <th>Proj %</th>
                  <th>TSI</th>
                </tr>
              </thead>
              <tbody>
                {topForecastTeams.map((team, index) => (
                  <tr key={team.code}>
                    <td>{index + 1}</td>
                    <td>{team.code}</td>
                    <td>{team.projectedWins}</td>
                    <td>{team.projectedWinRate}%</td>
                    <td>{team.tsi.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Playoff Bubble</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "700px" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>Playoff %</th>
                  <th>TSI</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {topPlayoffTeams.map((team, index) => (
                  <tr key={team.code}>
                    <td>{index + 1}</td>
                    <td>{team.code}</td>
                    <td>{team.playoffProbability}%</td>
                    <td>{team.tsi.toFixed(1)}</td>
                    <td>{(team.record.winPct * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid-layout" style={{ gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Division Power Snapshot</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "660px" }}>
              <thead>
                <tr>
                  <th>Division</th>
                  <th>Avg. TSI</th>
                  <th>Avg. Win %</th>
                  <th>Avg. Diff</th>
                  <th>Top Team</th>
                </tr>
              </thead>
              <tbody>
                {(divisionPower || []).map((division) => (
                  <tr key={`${division.conference}-${division.division}`}>
                    <td>{division.division}</td>
                    <td>{division.averageTSI}</td>
                    <td>{(division.averageWinPct * 100).toFixed(1)}%</td>
                    <td>{division.averagePointDiff}</td>
                    <td>{division.leader.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Conference Leadership</h2>
          {renderConferenceLeaders()}
        </div>
      </div>
    </div>
  );
}

window.LeagueInsightsPage = LeagueInsightsPage;
