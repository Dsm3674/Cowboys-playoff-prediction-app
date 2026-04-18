function ClutchIndex() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedSituation, setSelectedSituation] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("clutchIndex");
  const [sortOrder, setSortOrder] = React.useState("desc");
  const [expandedPlayer, setExpandedPlayer] = React.useState(null);

  React.useEffect(() => {
    loadClutchData();
  }, []);

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

  const getPerformanceColorClass = (value) => {
    if (value >= 75) return "intel-badge--success";
    if (value >= 60) return "intel-badge--warning";
    if (value >= 45) return "intel-badge--accent";
    return "intel-badge--danger";
  };

  const formatLabel = (value) => {
    if (!value) return "Unknown";
    return String(value)
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getSortedPlayers = () => {
    if (!data?.players) return [];

    const players = [...data.players];

    players.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      return sortOrder === "asc"
        ? aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        : aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
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

  const sortedPlayers = getSortedPlayers();

  if (loading) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div>
            <div className="intel-kicker">Loading</div>
            <h1 className="intel-title">Clutch Index</h1>
            <p className="intel-subtitle">Analyzing high-leverage performance...</p>
          </div>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="intel-page">
        <div className="intel-banner intel-banner--warning">
          Failed to load clutch data
        </div>
      </div>
    );
  }

  return (
    <div className="intel-page">

      {/* HERO */}
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Performance Intelligence</div>
          <h1 className="intel-title">Clutch Performance Index</h1>
          <p className="intel-subtitle">
            Evaluate player execution in high-leverage situations across pressure,
            red zone, close games, and fourth-quarter performance.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">High-Leverage Metrics</div>
          <div className="intel-chip intel-chip--muted">
            {data.players?.length || 0} Players
          </div>
        </div>
      </section>

      {/* TOP CARDS */}
      <section className="intel-grid intel-grid--support">

        <article className="intel-panel">
          <div className="intel-section-kicker">Top Performers</div>
          <div className="intel-section-title">Clutch Leaders</div>
          <div className="intel-rank-list">
            {data.leaders?.slice(0, 3).map((p, i) => (
              <div key={p.id} className="intel-rank-row">
                <div>
                  <div className="intel-rank-name">{i + 1}. {p.name}</div>
                  <div className="intel-rank-meta">{formatLabel(p.ranking)}</div>
                </div>
                <div className="intel-rank-value">
                  {p.clutchIndex.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="intel-panel">
          <div className="intel-section-kicker">Needs Lift</div>
          <div className="intel-section-title">Underperformers</div>
          <div className="intel-rank-list">
            {data.underperformers?.slice(0, 3).map((p) => (
              <div key={p.id} className="intel-rank-row">
                <div>
                  <div className="intel-rank-name">{p.name}</div>
                  <div className="intel-rank-meta">{formatLabel(p.ranking)}</div>
                </div>
                <div className="intel-rank-value intel-danger">
                  {p.clutchIndex.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="intel-panel">
          <div className="intel-section-kicker">Pressure Zones</div>
          <div className="intel-section-title">Team Situations</div>
          <div className="intel-stack">
            {data.teamStats?.situationAnalysis?.slice(0, 4).map((s, i) => (
              <div key={i} className="intel-bar-row">
                <div className="intel-bar-header">
                  <div className="intel-bar-label">{formatLabel(s.situation)}</div>
                  <div className="intel-bar-value">{Number(s.performance || 0).toFixed(0)}</div>
                </div>
                <div className="intel-bar">
                  <div
                    className={`intel-bar-fill ${getPerformanceColorClass(s.performance)}`}
                    style={{ width: `${s.performance}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

      </section>

      {/* TABLE */}
      <section className="intel-panel intel-panel--primary">
        <div className="intel-section-kicker">Player Snapshot</div>
        <div className="intel-section-title">Roster Breakdown</div>

        <div className="intel-table-wrap">
          <table className="intel-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("name")}>Player</th>
                <th onClick={() => handleSort("position")}>Pos</th>
                <th onClick={() => handleSort("clutchIndex")}>Clutch</th>
                <th onClick={() => handleSort("clutchFactor")}>Factor</th>
                <th>Ranking</th>
              </tr>
            </thead>

            <tbody>
              {sortedPlayers.map((player) => (
                <React.Fragment key={player.id}>
                  <tr
                    className="intel-row"
                    onClick={() =>
                      setExpandedPlayer(
                        expandedPlayer === player.id ? null : player.id
                      )
                    }
                  >
                    <td>{player.name}</td>
                    <td>{player.position}</td>
                    <td className="intel-bold">
                      {player.clutchIndex.toFixed(1)}
                    </td>
                    <td>
                      {player.clutchFactor > 0 ? "+" : ""}
                      {player.clutchFactor.toFixed(1)}
                    </td>
                    <td>
                      <span className="intel-badge">
                        {formatLabel(player.ranking)}
                      </span>
                    </td>
                  </tr>

                  {expandedPlayer === player.id && (
                    <tr className="intel-row-expanded">
                      <td colSpan="5">
                        <div className="intel-expanded">
                          <p>{player.profile?.suitability}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* INSIGHTS */}
      {data.insights?.length > 0 && (
        <section className="intel-panel">
          <div className="intel-section-kicker">Film Notes</div>
          <div className="intel-section-title">Insights</div>
          <div className="intel-insight-grid">
            {data.insights.map((insight, i) => (
              <div key={i} className="intel-insight-card">
                {insight}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

window.ClutchIndex = ClutchIndex;
