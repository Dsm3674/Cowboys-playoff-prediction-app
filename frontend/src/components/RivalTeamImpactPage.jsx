function RivalTeamImpactPage({ year = 2025 }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [chaos, setChaos] = React.useState(0);
  const [iterations, setIterations] = React.useState(1000);
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [sortBy, setSortBy] = React.useState("impactScore");

  React.useEffect(() => {
    loadRivalImpactData();
  }, [year]);

  const loadRivalImpactData = async () => {
    try {
      setLoading(true);
      const result = await window.api.getRivalImpact(year, chaos, iterations);
      setData(result);
    } catch (error) {
      console.error("Error loading rival impact:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = () => {
    loadRivalImpactData();
  };

  const handleChaosChange = (value) => {
    setChaos(value);
  };

  const handleIterationsChange = (value) => {
    setIterations(Math.max(100, Math.min(5000, value)));
  };

  if (!data && !loading) {
    return (
      <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#666" }}>Loading impact analysis.</p>
          <button
            onClick={loadRivalImpactData}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#0284c7",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              marginTop: "1rem",
            }}
          >
            Load Analysis
          </button>
        </div>
      </div>
    );
  }

  const impacts = data?.rivalImpacts || [];
  const cowboys = data?.cowboys || {};
  const rankedGames = data?.rankedGames || [];
  const sortedImpacts = [...impacts].sort((a, b) => {
    if (sortBy === "impactScore") return b.impactScore - a.impactScore;
    if (sortBy === "tsi") return b.tsi - a.tsi;
    if (sortBy === "winProbability") return b.winProbability - a.winProbability;
    return 0;
  });

  const selectedTeamData =
    selectedTeam ? impacts.find((team) => team.team === selectedTeam) : null;

  return (
    <div style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "2rem",
            fontWeight: "700",
            color: "#1e293b",
          }}
        >
          Rival Team Impact Analysis
        </h1>
        <p style={{ margin: 0, color: "#64748b", fontSize: "1rem" }}>
          Analyze how rival team outcomes affect Cowboys playoff odds with adjustable chaos and simulation depth.
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
          alignItems: "end",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "#334155",
            }}
          >
            Chaos Factor: {chaos.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={chaos}
            onChange={(e) => handleChaosChange(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
            Higher chaos increases variance and unpredictability
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.9rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "#334155",
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
            onChange={(e) => handleIterationsChange(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
            More iterations increases stability but takes longer
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
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Running..." : "Apply Changes"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Cowboys TSI</div>
          <div style={metricValueStyle}>{Number(cowboys.tsi || 0).toFixed(1)}</div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Cowboys Playoff Odds</div>
          <div style={metricValueStyle}>
            {Number(cowboys.playoffProbability || 0).toFixed(1)}%
          </div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Rivals Tracked</div>
          <div style={metricValueStyle}>{impacts.length}</div>
        </div>

        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>Top Impact Team</div>
          <div style={metricValueStyle}>
            {sortedImpacts[0]?.team || "--"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "10px",
            padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "1.2rem",
                color: "#1e293b",
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
                background: "#fff",
              }}
            >
              <option value="impactScore">Sort by Impact</option>
              <option value="tsi">Sort by TSI</option>
              <option value="winProbability">Sort by Win Probability</option>
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
                      background:
                        selectedTeam === team.team ? "#e0f2fe" : "transparent",
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: "600" }}>{team.team}</div>
                      <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                        {team.tier || "Rival"}
                      </div>
                    </td>
                    <td style={tdStyle}>{Number(team.tsi || 0).toFixed(1)}</td>
                    <td style={tdStyle}>{Number(team.impactScore || 0).toFixed(1)}</td>
                    <td style={tdStyle}>{Number(team.winProbability || 0).toFixed(1)}%</td>
                    <td style={tdStyle}>{team.recommendedOutcome || "--"}</td>
                  </tr>
                ))}
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
                  gap: "0.8rem",
                }}
              >
                {rankedGames.map((game, idx) => (
                  <div
                    key={`${game.team || "game"}-${idx}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "0.9rem",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ fontWeight: "700", color: "#0f172a" }}>
                      {game.team || game.teamName || "Rival Game"}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.35rem" }}>
                      Impact: {Number(game.impactScore || 0).toFixed(1)}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>
                      Playoff Swing: {Number(game.playoffImpactPercentage || 0).toFixed(2)}%
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
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "1rem",
              fontSize: "1.2rem",
              color: "#1e293b",
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
                  marginBottom: "0.8rem",
                }}
              >
                {selectedTeamData.team}
              </div>

              <div style={detailRowStyle}>
                <span>TSI</span>
                <strong>{Number(selectedTeamData.tsi || 0).toFixed(1)}</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Impact Score</span>
                <strong>{Number(selectedTeamData.impactScore || 0).toFixed(1)}</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Win Probability</span>
                <strong>{Number(selectedTeamData.winProbability || 0).toFixed(1)}%</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Playoff Impact</span>
                <strong>{Number(selectedTeamData.playoffImpactPercentage || 0).toFixed(2)}%</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Recommended Outcome</span>
                <strong>{selectedTeamData.recommendedOutcome || "--"}</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Best Case</span>
                <strong>{Number(selectedTeamData.bestCaseScenario || 0).toFixed(1)}%</strong>
              </div>

              <div style={detailRowStyle}>
                <span>Worst Case</span>
                <strong>{Number(selectedTeamData.worstCaseScenario || 0).toFixed(1)}%</strong>
              </div>

              {selectedTeamData.breakdown ? (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.9rem",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
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
        </div>
      </div>
    </div>
  );
}

const metricCardStyle = {
  background: "#fff",
  borderRadius: "10px",
  padding: "1rem",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const metricLabelStyle = {
  color: "#64748b",
  fontSize: "0.85rem",
  marginBottom: "0.5rem",
};

const metricValueStyle = {
  color: "#0f172a",
  fontSize: "1.6rem",
  fontWeight: "700",
};

const thStyle = {
  textAlign: "left",
  padding: "0.8rem",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "0.85rem",
};

const tdStyle = {
  padding: "0.85rem",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a",
};

const detailRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "0.55rem 0",
  borderBottom: "1px solid #f1f5f9",
  color: "#334155",
};

window.RivalTeamImpactPage = RivalTeamImpactPage;
