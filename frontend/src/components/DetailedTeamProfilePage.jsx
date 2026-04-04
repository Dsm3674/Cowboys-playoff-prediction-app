const { useEffect, useState } = React;

function DetailedTeamProfilePage({ year = new Date().getFullYear(), selectedTeam = "DAL" }) {
  const [record, setRecord] = useState(null);
  const [tsi, setTsi] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [mustWin, setMustWin] = useState([]);
  const [paths, setPaths] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    setRecord(null);
    setTsi(null);
    setSchedule([]);
    setMustWin([]);
    setPaths(null);

    Promise.allSettled([
      window.api.getRecord(year, selectedTeam),
      window.api.getTSI(selectedTeam, year),
      window.api.getSchedule(year, selectedTeam),
      window.api.getMustWin(selectedTeam, year),
      window.api.getPaths(selectedTeam, year, 12, 0)
    ])
      .then((results) => {
        const [recordResult, tsiResult, scheduleResult, mustWinResult, pathsResult] = results;

        if (recordResult.status === "fulfilled") {
          setRecord(recordResult.value);
        }

        if (tsiResult.status === "fulfilled") {
          setTsi(tsiResult.value);
        }

        if (scheduleResult.status === "fulfilled") {
          setSchedule(scheduleResult.value.games || []);
        }

        if (mustWinResult.status === "fulfilled") {
          setMustWin(mustWinResult.value.games || []);
        }

        if (pathsResult.status === "fulfilled") {
          setPaths(pathsResult.value);
        }

        const failed = results.filter((item) => item.status === "rejected");
        if (failed.length > 0) {
          setError("Some team profile data could not be loaded. Refresh to retry.");
        }
      })
      .catch((err) => setError(err?.message || "Failed to load profile data."))
      .finally(() => setLoading(false));
  }, [year, selectedTeam]);

  const upcoming = schedule.filter((game) => !game.completed).slice(0, 5);
  const topMustWin = mustWin.slice(0, 3);
  const pathRows = (paths?.paths || []).slice(0, 5);

  if (loading) {
    return (
      <div className="card">
        <h2>Team Profile</h2>
        <p className="text-muted">Loading {selectedTeam} analytics and season outlook for {year}...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ marginTop: 0 }}>{selectedTeam} Profile</h1>
        <p className="text-small text-muted">
          A complete team snapshot for {selectedTeam}, including record, TSI, schedule, must-win games, and season path outlook.
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: "1.5rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Current Record</h3>
          {record ? (
            <div>
              <p className="text-large" style={{ margin: 0 }}>{record.wins}-{record.losses}-{record.ties}</p>
              {typeof record.winPct === "number" ? (
                <p className="text-small text-muted">Win percentage: {(record.winPct * 100).toFixed(1)}%</p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted">Record not available.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Team Strength Index</h3>
          {tsi ? (
            <div>
              <p className="text-large" style={{ margin: 0 }}>{tsi.tsi}</p>
              <p className="text-small text-muted">Offense: {tsi.components.offense} · Defense: {tsi.components.defense}</p>
            </div>
          ) : (
            <p className="text-muted">TSI not available.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Path Confidence</h3>
          {paths ? (
            <div>
              <p className="text-large" style={{ margin: 0 }}>{(paths?.paths?.[0]?.probability * 100 || 0).toFixed(1)}%</p>
              <p className="text-small text-muted">Top projected path probability.</p>
            </div>
          ) : (
            <p className="text-muted">Path data not available.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Upcoming Schedule</h2>
        {upcoming.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {upcoming.map((game, index) => (
              <div key={index} style={{ padding: "1rem", borderRadius: "10px", background: "#f8fafc" }}>
                <div style={{ fontWeight: 700 }}>{game.homeTeamAbbr === selectedTeam ? "vs " : "@ "}{game.homeTeamAbbr === selectedTeam ? game.awayTeamAbbr : game.homeTeamAbbr}</div>
                <div className="text-small text-muted">{new Date(game.date).toLocaleDateString()}</div>
                <div className="text-small" style={{ marginTop: "0.5rem" }}>{game.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No upcoming games found.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Must-Win Games</h2>
        {topMustWin.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {topMustWin.map((game, index) => (
              <div key={index} style={{ padding: "1rem", borderRadius: "10px", background: "#fff", border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700 }}>vs {game.opp}</div>
                <div className="text-small text-muted">{new Date(game.date).toLocaleDateString()}</div>
                <div className="text-small" style={{ marginTop: "0.4rem" }}>Swing: {(game.swing * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No high-leverage games were identified.</p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Projected Season Paths</h2>
        {pathRows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "680px" }}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Probability</th>
                  <th>Wins Added</th>
                  <th>Path Summary</th>
                </tr>
              </thead>
              <tbody>
                {pathRows.map((path, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{(path.probability * 100).toFixed(1)}%</td>
                    <td>{path.winsAdded}</td>
                    <td>{(path.outcomes || []).map((outcome) => outcome.result).join("-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">Path simulation results are unavailable.</p>
        )}
      </div>

      {error ? (
        <div className="card" style={{ marginTop: "1rem", borderLeft: "4px solid #dc2626" }}>
          <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>
        </div>
      ) : null}
    </div>
  );
}

window.DetailedTeamProfilePage = DetailedTeamProfilePage;
