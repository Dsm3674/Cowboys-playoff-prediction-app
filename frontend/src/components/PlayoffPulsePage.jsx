const { useEffect, useState } = React;

function PlayoffPulsePage({ year = new Date().getFullYear() }) {
  const [pulse, setPulse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    window.api
      .getPlayoffPulse(year)
      .then((data) => {
        if (!data || !Array.isArray(data.pulse)) throw new Error("No playoff pulse data available.");
        setPulse(data.pulse);
      })
      .catch((err) => setError(err?.message || "Unable to load playoff pulse."))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) {
    return (
      <div>
        <div className="data-grid three-col" style={{ marginBottom: "1.25rem" }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton-block metric-tile" style={{ height: "90px" }}></div>
          ))}
        </div>
        <div className="skeleton-block" style={{ height: "250px", borderRadius: "8px" }}></div>
      </div>
    );
  }

  if (error) {
    return <div className="card" style={{ borderLeft: "3px solid var(--accent-danger)" }}><p className="text-muted">{error}</p></div>;
  }

  const favorites = pulse.slice(0, 6);
  const bubble = pulse.slice(6, 14);
  const rest = pulse.slice(14);
  const lockCount = pulse.filter(t => t.playoffProbability >= 80).length;

  return (
    <div>
      <div className="key-insight" style={{ marginBottom: "1.5rem" }}>
        {lockCount} teams currently tracking at 80%+ playoff probability
      </div>

      <div className="section-label">Playoff Favorites</div>
      <div className="data-grid three-col" style={{ marginBottom: "2rem" }}>
        {favorites.map((team, i) => (
          <div key={team.code} className="metric-tile">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="metric-value accent">{team.playoffProbability}%</div>
                <div className="metric-label">{team.code}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--fg-dim)", fontWeight: 600 }}>
                  {team.record.wins}-{team.record.losses}-{team.record.ties}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                  TSI {team.tsi.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="strength-bar" style={{ marginTop: "0.6rem" }}>
              <div className="strength-bar__fill" style={{ width: `${team.playoffProbability}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      {bubble.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <div className="section-label">Bubble Teams</div>
          <div className="data-table-wrap">
            <table style={{ minWidth: "600px" }}>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Playoff %</th>
                  <th style={{ width: "120px" }}>Outlook</th>
                  <th>TSI</th>
                  <th>Record</th>
                  <th>Avg Diff</th>
                </tr>
              </thead>
              <tbody>
                {bubble.map((team) => (
                  <tr key={team.code}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                    <td className="text-accent" style={{ fontWeight: 700 }}>{team.playoffProbability}%</td>
                    <td>
                      <div className="prob-bar-inline">
                        <div className="bar"><div className="bar-fill" style={{ width: `${team.playoffProbability}%` }}></div></div>
                      </div>
                    </td>
                    <td>{team.tsi.toFixed(1)}</td>
                    <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                    <td>{team.averagePointDiff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <div className="section-label">Full League Outlook</div>
          <div className="data-table-wrap">
            <table style={{ minWidth: "660px" }}>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Conf</th>
                  <th>Div</th>
                  <th>Playoff %</th>
                  <th>TSI</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((team) => (
                  <tr key={team.code}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{team.code}</td>
                    <td>{team.conference}</td>
                    <td>{team.division}</td>
                    <td style={{ color: team.playoffProbability > 50 ? "var(--accent)" : "var(--muted)" }}>
                      {team.playoffProbability}%
                    </td>
                    <td>{team.tsi.toFixed(1)}</td>
                    <td>{team.record.wins}-{team.record.losses}-{team.record.ties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

window.PlayoffPulsePage = PlayoffPulsePage;
