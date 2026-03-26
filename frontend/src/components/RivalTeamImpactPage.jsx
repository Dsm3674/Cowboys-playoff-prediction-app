function RivalTeamImpactPage({ year = 2025 }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [chaos, setChaos] = React.useState(0);
  const [iterations, setIterations] = React.useState(1000);
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [sortBy, setSortBy] = React.useState("impactScore");

  React.useEffect(() => {
    loadRivalImpactData();
  }, [year]);

  async function loadRivalImpactData() {
    try {
      setLoading(true);
      setError("");
      const result = await window.api.getRivalImpact(year, chaos, iterations);
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load rival impact analysis.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleApplyChanges() {
    loadRivalImpactData();
  }

  const impacts = Array.isArray(data?.rivalImpacts) ? data.rivalImpacts : [];
  const cowboys = data?.cowboys || {};
  const rankedGames = Array.isArray(data?.rankedGames) ? data.rankedGames : [];
  const summary = data?.summary || {};

  const sortedImpacts = [...impacts].sort((a, b) => {
    if (sortBy === "impactScore") return (b.impactScore || 0) - (a.impactScore || 0);
    if (sortBy === "tsi") return (b.tsi || 0) - (a.tsi || 0);
    if (sortBy === "winProbability") return (b.winProbability || 0) - (a.winProbability || 0);
    return String(a.team || "").localeCompare(String(b.team || ""));
  });

  const selectedTeamData = selectedTeam
    ? impacts.find((team) => team.team === selectedTeam)
    : null;

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "2rem",
            fontWeight: "700",
            color: "#1e293b"
          }}
        >
          Rival Team Impact Analysis
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "1rem" }}>
          Analyze how rival outcomes affect Cowboys playoff odds.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "10px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: "1.5rem",
          alignItems: "end"
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "#334155"
            }}
          >
            Chaos Factor: {Number(chaos).toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={chaos}
            onChange={(e) => setChaos(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
            If supported by the backend, higher chaos increases variance.
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "#334155"
            }}
          >
            Iterations: {iterations}
          </label>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            value={iterations}
            onChange={(e) => setIterations(Math.max(100, Math.min(5000, Number(e.target.value))))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
            If ignored by the backend, this will not affect the result.
          </div>
        </div>

        <button
          onClick={handleApplyChanges}
          disabled={loading}
          style={{
            padding: "0.85rem 1.4rem",
            background: loading ? "#94a3b8" : "#0284c7",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "0.95rem",
            fontWeight: "600",
            whiteSpace: "nowrap"
          }}
        >
          {loading ? "Running..." : "Apply Changes"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            background: "#fff1f2",
            color: "#b91c1c",
            border: "1px solid #fecdd3",
            borderRadius: "10px",
            padding: "1rem 1.2rem",
            marginBottom: "1.5rem"
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Cowboys TSI</div>
          <div style={metricValueStyle}>{formatValue(cowboys.tsi, 1)}</div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Playoff Probability</div>
          <div style={metricValueStyle}>
            {formatValue(cowboys.playoffProbability ?? cowboys.baselinePlayoffProbability, 1)}%
          </div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Rivals Tracked</div>
          <div style={metricValueStyle}>{impacts.length}</div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Top Impact Team</div>
          <div style={metricValueStyle}>{sortedImpacts[0]?.team || "--"}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "1.5rem",
          alignItems: "start"
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem"
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.2rem",
                color: "#1e293b"
              }}
            >
              Rival Impact Rankings
            </h2>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#fff"
              }}
            >
              <option value="impactScore">Sort by Impact</option>
              <option value="tsi">Sort by TSI</option>
              <option value="winProbability">Sort by Win Probability</option>
              <option value="team">Sort by Team</option>
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Team</th>
                  <th style={thStyle}>TSI</th>
                  <th style={thStyle}>Impact</th>
                  <th style={thStyle}>Win %</th>
                  <th style={thStyle}>Recommended Outcome</th>
                </tr>
              </thead>
              <tbody>
                {sortedImpacts.map((team) => (
                  <tr
                    key={team.team}
                    onClick={() => setSelectedTeam(team.team)}
                    style={{
                      cursor: "pointer",
                      background: selectedTeam === team.team ? "#e0f2fe" : "transparent"
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: "600" }}>{team.team}</div>
                      <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                        {team.tier || "Rival"}
                      </div>
                    </td>
                    <td style={tdStyle}>{formatValue(team.tsi, 1)}</td>
                    <td style={tdStyle}>{formatValue(team.impactScore, 1)}</td>
                    <td style={tdStyle}>{formatValue(team.winProbability, 1)}%</td>
                    <td style={tdStyle}>{team.recommendedOutcome || "--"}</td>
                  </tr>
                ))}

                {!sortedImpacts.length ? (
                  <tr>
                    <td style={tdStyle} colSpan="5">No rival data returned.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {rankedGames.length > 0 ? (
            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ color: "#1e293b", marginBottom: "0.75rem" }}>
                Ranked Rival Games
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "0.8rem"
                }}
              >
                {rankedGames.map((game, idx) => (
                  <div
                    key={`${game.team || "game"}-${idx}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "0.9rem",
                      background: "#f8fafc"
                    }}
                  >
                    <div style={{ fontWeight: "700", color: "#0f172a" }}>
                      {game.team || game.teamName || "Rival Game"}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
                      Impact: {formatValue(game.impactScore, 1)}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>
                      Playoff Swing: {formatValue(game.playoffImpactPercentage, 2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "1rem",
              fontSize: "1.2rem",
              color: "#1e293b"
            }}
          >
            Team Details
          </h2>

          {!selectedTeamData ? (
            <div style={{ color: "#64748b" }}>
              Select a rival team from the table to inspect its breakdown.
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: "700",
                  color: "#0f172a",
                  marginBottom: "0.8rem"
                }}
              >
                {selectedTeamData.team}
              </div>

              <div style={detailRowStyle}>
                <span>TSI</span>
                <strong>{formatValue(selectedTeamData.tsi, 1)}</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Impact Score</span>
                <strong>{formatValue(selectedTeamData.impactScore, 1)}</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Win Probability</span>
                <strong>{formatValue(selectedTeamData.winProbability, 1)}%</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Playoff Impact</span>
                <strong>{formatValue(selectedTeamData.playoffImpactPercentage, 2)}%</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Recommended Outcome</span>
                <strong>{selectedTeamData.recommendedOutcome || "--"}</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Best Case</span>
                <strong>{formatValue(selectedTeamData.bestCaseScenario, 1)}%</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Worst Case</span>
                <strong>{formatValue(selectedTeamData.worstCaseScenario, 1)}%</strong>
              </div>

              {selectedTeamData.breakdown ? (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.9rem",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div style={{ fontWeight: "700", color: "#0f172a", marginBottom: "0.6rem" }}>
                    Breakdown
                  </div>

                  {Object.entries(selectedTeamData.breakdown).map(([key, value]) => (
                    <div key={key} style={detailRowStyle}>
                      <span>{key}</span>
                      <strong>{typeof value === "number" ? value.toFixed(2) : String(value)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {summary?.narrative ? (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.9rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                color: "#334155",
                lineHeight: 1.5
              }}
            >
              {summary.narrative}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatValue(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

const metricCardStyle = {
  background: "#fff",
  borderRadius: "10px",
  padding: "1rem",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
};

const metricLabelStyle = {
  color: "#64748b",
  fontSize: "0.85rem",
  marginBottom: "0.5rem"
};

const metricValueStyle = {
  color: "#0f172a",
  fontSize: "1.6rem",
  fontWeight: "700"
};

const thStyle = {
  textAlign: "left",
  padding: "0.8rem",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "0.85rem"
};

const tdStyle = {
  padding: "0.85rem",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a"
};

const detailRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "0.55rem 0",
  borderBottom: "1px solid #f1f5f9",
  color: "#334155"
};

window.RivalTeamImpactPage = RivalTeamImpactPage;
