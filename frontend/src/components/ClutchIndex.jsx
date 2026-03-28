
function ClutchIndex() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const[selectedSituation, setSelectedSituation] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("clutchIndex");
  const [sortOrder, setSortOrder] = React.useState("desc");
  const[expandedPlayer, setExpandedPlayer] = React.useState(null);

  React.useEffect(() => {
    loadClutchData();
  },[]);

  const loadClutchData = async () => {
    try {
      setLoading(true);
      const result = await window.api.getClutchIndex(2025);
      setData(result);
    } catch (error) {
      console.error("Error loading clutch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (performance) => {
    if (performance >= 75) return "#10b981"; // Green
    if (performance >= 60) return "#f59e0b"; // Amber
    if (performance >= 45) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const getSortedPlayers = () => {
    if (!data || !data.players) return [];
    const players = [...data.players];

    players.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return players;
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getRankingColor = (ranking) => {
    switch (ranking) {
      case "CLUTCH_KING": return "#10b981";
      case "RELIABLE_PERFORMER": return "#3b82f6";
      case "NEUTRAL": return "#6b7280";
      case "INCONSISTENT": return "#f97316";
      case "CHOKE_PRONE": return "#ef4444";
      case "CLUTCH_DEPENDENT": return "#8b5cf6";
      default: return "#6b7280";
    }
  };

  const getRankingLabel = (ranking) => {
    switch (ranking) {
      case "CLUTCH_KING": return "Clutch King";
      case "RELIABLE_PERFORMER": return "Reliable Performer";
      case "NEUTRAL": return "Neutral";
      case "INCONSISTENT": return "Inconsistent";
      case "CHOKE_PRONE": return "Choke-Prone";
      case "CLUTCH_DEPENDENT": return "Clutch Dependent";
      default: return ranking;
    }
  };

  const formatSituationName = (sit) => {
    const map = {
      "red_zone": "Red Zone",
      "high_leverage": "High Leverage (3rd/4th Down)",
      "fourth_quarter": "4th Quarter",
      "close_games": "Close Games",
      "pressure": "Under Pressure"
    };
    return map[sit] || sit;
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: "18px", marginBottom: "10px", fontWeight: "bold", color: "#003594" }}>Processing Clutch Algorithms...</div>
        <div style={{ fontSize: "14px" }}>Analyzing high-leverage performance metrics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold" }}>Failed to load clutch data</div>
      </div>
    );
  }

  const sortedPlayers = getSortedPlayers();

  return (
    <div style={{ padding: "20px", backgroundColor: "#ffffff", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#003594", fontSize: "28px" }}>Clutch Performance Index</h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "15px" }}>
          Advanced analysis of player execution in critical, high-leverage situations.
        </p>
      </div>

      {/* HTML/CSS Dashboard (Replaces the broken Canvas) */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
        gap: "20px", 
        marginBottom: "30px" 
      }}>
        
        {/* Leaders Card */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ backgroundColor: "#f0fdf4", padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", color: "#166534", display: "flex", justifyContent: "space-between" }}>
            <span>🏆 Clutch Leaders</span>
          </div>
          <div style={{ padding: "16px" }}>
            {data.leaders?.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < 2 ? "12px" : "0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#1f2937", fontSize: "14px" }}>{p.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>{getRankingLabel(p.ranking)}</div>
                  </div>
                </div>
                <div style={{ fontWeight: "bold", color: "#10b981", fontSize: "16px" }}>{p.clutchIndex.toFixed(1)}</div>
              </div>
            ))}
            {(!data.leaders || data.leaders.length === 0) && <div style={{ color: "#6b7280", fontSize: "14px" }}>No clear leaders identified yet.</div>}
          </div>
        </div>

        {/* Underperformers Card */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ backgroundColor: "#fef2f2", padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", color: "#991b1b", display: "flex", justifyContent: "space-between" }}>
            <span>⚠️ Warning Zone</span>
          </div>
          <div style={{ padding: "16px" }}>
            {data.underperformers?.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: i < 2 ? "12px" : "0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>📉</span>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#1f2937", fontSize: "14px" }}>{p.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>{getRankingLabel(p.ranking)}</div>
                  </div>
                </div>
                <div style={{ fontWeight: "bold", color: "#ef4444", fontSize: "16px" }}>{p.clutchIndex.toFixed(1)}</div>
              </div>
            ))}
            {(!data.underperformers || data.underperformers.length === 0) && <div style={{ color: "#6b7280", fontSize: "14px" }}>No severe underperformers identified.</div>}
          </div>
        </div>

        {/* Situational Breakdown Card */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "bold", color: "#1e293b", display: "flex", justifyContent: "space-between" }}>
            <span>📊 Team Situations</span>
          </div>
          <div style={{ padding: "16px" }}>
            {data.teamStats?.situationAnalysis?.slice(0, 4).map((sit, i) => (
              <div key={i} style={{ marginBottom: i < 3 ? "12px" : "0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px", color: "#4b5563", fontWeight: "bold" }}>
                  <span>{formatSituationName(sit.situation)}</span>
                  <span>{sit.performance.toFixed(0)}/100</span>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ 
                    height: "100%", 
                    backgroundColor: getPerformanceColor(sit.performance), 
                    width: `${Math.min(100, Math.max(0, sit.performance))}%` 
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Players Table */}
      <h3 style={{ margin: "0 0 16px 0", color: "#1f2937", fontSize: "20px" }}>In-Depth Roster Analysis</h3>
      
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
              <th style={thStyle} onClick={() => handleSort("name")}>Player {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th style={{...thStyle, textAlign: "center"}} onClick={() => handleSort("position")}>Pos</th>
              <th style={{...thStyle, textAlign: "center"}} onClick={() => handleSort("clutchIndex")}>Clutch Index {sortBy === "clutchIndex" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th style={{...thStyle, textAlign: "center"}} onClick={() => handleSort("clutchFactor")}>Factor {sortBy === "clutchFactor" && (sortOrder === "asc" ? "↑" : "↓")}</th>
              <th style={{...thStyle, textAlign: "center"}} onClick={() => handleSort("ranking")}>Ranking</th>
              <th style={{...thStyle, textAlign: "center"}}>Specific Metrics (0-100)</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, idx) => (
              <React.Fragment key={player.id}>
                {/* Main Row */}
                <tr
                  onClick={() => setExpandedPlayer(expandedPlayer === player.id ? null : player.id)}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    backgroundColor: expandedPlayer === player.id ? "#f0f9ff" : (idx % 2 === 0 ? "#ffffff" : "#f9fafb"),
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#9ca3af", transition: "transform 0.2s", transform: expandedPlayer === player.id ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    {player.name}
                  </td>
                  <td style={{ padding: "14px", textAlign: "center", color: "#6b7280", fontWeight: "bold" }}>
                    {player.position}
                  </td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: "bold", fontSize: "16px", color: getPerformanceColor(player.clutchIndex) }}>
                        {player.clutchIndex.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "14px", textAlign: "center", fontWeight: "bold", color: player.clutchFactor > 0 ? "#10b981" : player.clutchFactor < 0 ? "#ef4444" : "#6b7280" }}>
                    {player.clutchFactor > 0 ? "+" : ""}{player.clutchFactor.toFixed(1)}
                  </td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    <span style={{ 
                      padding: "4px 10px", 
                      borderRadius: "999px", 
                      fontSize: "12px", 
                      fontWeight: "bold", 
                      backgroundColor: getRankingColor(player.ranking) + "20", 
                      color: getRankingColor(player.ranking),
                      border: `1px solid ${getRankingColor(player.ranking)}50`
                    }}>
                      {getRankingLabel(player.ranking)}
                    </span>
                  </td>
                  <td style={{ padding: "14px", textAlign: "center", fontSize: "12px", color: "#4b5563" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", textAlign: "left", maxWidth: "200px", margin: "0 auto" }}>
                      {/* FIX: Removed .metrics nesting based on backend payload mapping */}
                      <div><strong>4Q:</strong> <span style={{color: getPerformanceColor(player.fourthQuarterPerf)}}>{player.fourthQuarterPerf?.toFixed(0) || "N/A"}</span></div>
                      <div><strong>Lev:</strong> <span style={{color: getPerformanceColor(player.highLeveragePerf)}}>{player.highLeveragePerf?.toFixed(0) || "N/A"}</span></div>
                      <div><strong>RZ:</strong> <span style={{color: getPerformanceColor(player.redZonePerf)}}>{player.redZonePerf?.toFixed(0) || "N/A"}</span></div>
                      <div><strong>Close:</strong> <span style={{color: getPerformanceColor(player.closeGamePerf)}}>{player.closeGamePerf?.toFixed(0) || "N/A"}</span></div>
                    </div>
                  </td>
                </tr>

                {/* Expanded Profile Row */}
                {expandedPlayer === player.id && (
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                    <td colSpan="6" style={{ padding: "20px" }}>
                      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                        
                        <div style={{ flex: "1 1 300px" }}>
                          <h4 style={{ margin: "0 0 12px 0", color: "#003594", display: "flex", alignItems: "center", gap: "6px" }}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Tactical Suitability
                          </h4>
                          <p style={{ margin: 0, color: "#374151", fontSize: "14px", lineHeight: "1.5", backgroundColor: "#fff", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                            {player.profile?.suitability || "Insufficient data to generate tactical profile."}
                          </p>
                        </div>

                        <div style={{ flex: "1 1 200px" }}>
                          <h4 style={{ margin: "0 0 12px 0", color: "#166534" }}>Strengths</h4>
                          {player.profile?.strengths?.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: "16px", color: "#374151", fontSize: "13px", lineHeight: "1.6" }}>
                              {player.profile.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          ) : (
                            <span style={{ fontSize: "13px", color: "#9ca3af" }}>No elite situational traits detected.</span>
                          )}
                        </div>

                        <div style={{ flex: "1 1 200px" }}>
                          <h4 style={{ margin: "0 0 12px 0", color: "#991b1b" }}>Vulnerabilities</h4>
                          {player.profile?.weaknesses?.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: "16px", color: "#374151", fontSize: "13px", lineHeight: "1.6" }}>
                              {player.profile.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                          ) : (
                            <span style={{ fontSize: "13px", color: "#9ca3af" }}>No critical vulnerabilities detected.</span>
                          )}
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key Insights Auto-Generated by Backend */}
      {data.insights && data.insights.length > 0 && (
        <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px" }}>
          <div style={{ fontWeight: "bold", color: "#0369a1", marginBottom: "12px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>💡</span> Algorithm Insights
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {data.insights.map((insight, idx) => (
              <div key={idx} style={{ backgroundColor: "#fff", padding: "12px", borderRadius: "6px", fontSize: "14px", color: "#334155", borderLeft: "3px solid #38bdf8", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "16px 14px",
  textAlign: "left",
  fontWeight: "bold",
  color: "#475569",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap"
};

window.ClutchIndex = ClutchIndex;
