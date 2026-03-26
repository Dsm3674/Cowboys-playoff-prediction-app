function RivalTeamImpactPage({ year = new Date().getFullYear() }) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [sortBy, setSortBy] = React.useState("impactScore");
  const [sortDirection, setSortDirection] = React.useState("desc");

  const loadRivalImpactData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await window.api.getRivalImpact(year);
      setData(result);
    } catch (err) {
      setError(err.message || "Unable to load rival impact analysis.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year]);

  React.useEffect(() => {
    loadRivalImpactData();
  }, [loadRivalImpactData]);

  const impacts = React.useMemo(() => {
    const raw = Array.isArray(data?.rivalImpacts) ? [...data.rivalImpacts] : [];

    raw.sort((a, b) => {
      const aValue = a?.[sortBy];
      const bValue = b?.[sortBy];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      }

      const aText = String(aValue ?? "");
      const bText = String(bValue ?? "");

      if (sortDirection === "desc") return bText.localeCompare(aText);
      return aText.localeCompare(bText);
    });

    return raw;
  }, [data, sortBy, sortDirection]);

  const cowboys = data?.cowboys || {};
  const summary = data?.summary || {};
  const unavailableTeams = Array.isArray(data?.unavailableTeams)
    ? data.unavailableTeams
    : [];

  const selectedDetails =
    impacts.find((item) => item.team === selectedTeam) || null;

  function changeSort(nextSortBy) {
    if (nextSortBy === sortBy) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDirection("desc");
  }

  if (loading && !data) {
    return (
      <div style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Rival Impact Analysis</h1>
          <p style={styles.subtitle}>Loading deterministic playoff pressure data.</p>
        </div>
        <div style={styles.panel}>
          <div style={styles.skeletonBar}></div>
          <div style={{ ...styles.skeletonBar, width: "80%" }}></div>
          <div style={{ ...styles.skeletonBar, width: "60%" }}></div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Rival Impact Analysis</h1>
          <p style={styles.subtitle}>Live NFC and cross-conference pressure view.</p>
        </div>

        <div style={styles.errorBox}>
          <div style={styles.errorTitle}>Could not load rival impact data</div>
          <div style={styles.errorText}>{error}</div>
          <button style={styles.primaryButton} onClick={loadRivalImpactData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <h1 style={styles.title}>Rival Impact Analysis</h1>
          <p style={styles.subtitle}>
            Deterministic view based on real TSI and record context.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button style={styles.secondaryButton} onClick={loadRivalImpactData}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div style={styles.inlineWarning}>
          Latest refresh failed: {error}
        </div>
      ) : null}

      <div style={styles.topGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Cowboys TSI</div>
          <div style={styles.metricValue}>
            {formatNumber(cowboys.tsi, 1)}
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Baseline Playoff Probability</div>
          <div style={styles.metricValue}>
            {formatNumber(cowboys.baselinePlayoffProbability, 1)}%
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>NFC Rank</div>
          <div style={styles.metricValue}>
            {summary.nfcRank ?? "--"}
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Aggregate Pressure</div>
          <div style={styles.metricValue}>
            {formatNumber(summary.aggregatePressure, 1)}
          </div>
        </div>
      </div>

      <div style={styles.infoPanel}>
        <div style={styles.infoTitle}>What changed</div>
        <ul style={styles.infoList}>
          <li>Chaos and iterations controls were removed.</li>
          <li>Rival analysis now reflects deterministic backend output only.</li>
          <li>The page surfaces fetch failures directly in the UI.</li>
        </ul>
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.leftColumn}>
          <div style={styles.tableCard}>
            <div style={styles.tableHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Rival Pressure Ranking</h2>
                <p style={styles.sectionText}>
                  Sorted view of teams affecting Dallas playoff positioning.
                </p>
              </div>

              <div style={styles.sortRow}>
                <button style={sortButtonStyle(sortBy === "impactScore")} onClick={() => changeSort("impactScore")}>
                  Impact
                </button>
                <button style={sortButtonStyle(sortBy === "tsi")} onClick={() => changeSort("tsi")}>
                  TSI
                </button>
                <button style={sortButtonStyle(sortBy === "winProbability")} onClick={() => changeSort("winProbability")}>
                  Win %
                </button>
                <button style={sortButtonStyle(sortBy === "teamName")} onClick={() => changeSort("teamName")}>
                  Team
                </button>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Team</th>
                    <th style={styles.th}>Tier</th>
                    <th style={styles.th}>Impact</th>
                    <th style={styles.th}>Urgency</th>
                    <th style={styles.th}>TSI</th>
                    <th style={styles.th}>Win %</th>
                    <th style={styles.th}>Desired Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {impacts.map((item) => {
                    const isSelected = selectedTeam === item.team;
                    return (
                      <tr
                        key={item.team}
                        style={isSelected ? styles.rowSelected : styles.row}
                        onClick={() => setSelectedTeam(item.team)}
                      >
                        <td style={styles.td}>
                          <div style={{ fontWeight: 700 }}>{item.teamName}</div>
                          <div style={styles.tdSub}>{item.team}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={badgeStyle(getTierColor(item.tier))}>
                            {item.tier}
                          </span>
                        </td>
                        <td style={styles.td}>{formatNumber(item.impactScore, 1)}</td>
                        <td style={styles.td}>
                          <span style={badgeStyle(getUrgencyColor(item.urgency))}>
                            {item.urgency}
                          </span>
                        </td>
                        <td style={styles.td}>{formatNumber(item.tsi, 1)}</td>
                        <td style={styles.td}>{formatNumber(item.winProbability, 1)}%</td>
                        <td style={styles.td}>{item.recommendedOutcome}</td>
                      </tr>
                    );
                  })}

                  {!impacts.length ? (
                    <tr>
                      <td style={styles.emptyCell} colSpan="7">
                        No rival impact rows were returned.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {unavailableTeams.length ? (
            <div style={styles.warningCard}>
              <h3 style={styles.warningTitle}>Unavailable teams</h3>
              <ul style={styles.warningList}>
                {unavailableTeams.map((item) => (
                  <li key={item.team}>
                    <strong>{item.teamName}</strong>: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.detailCard}>
            <h2 style={styles.sectionTitle}>Selected Rival Detail</h2>

            {!selectedDetails ? (
              <p style={styles.sectionText}>
                Select a row to inspect detailed playoff pressure breakdown.
              </p>
            ) : (
              <>
                <div style={styles.detailTop}>
                  <div>
                    <div style={styles.detailTeam}>{selectedDetails.teamName}</div>
                    <div style={styles.detailMeta}>
                      {selectedDetails.team} · {selectedDetails.conference} · {selectedDetails.division}
                    </div>
                  </div>

                  <span style={badgeStyle(getUrgencyColor(selectedDetails.urgency))}>
                    {selectedDetails.urgency}
                  </span>
                </div>

                <div style={styles.detailGrid}>
                  <MetricBox
                    label="Impact Score"
                    value={formatNumber(selectedDetails.impactScore, 1)}
                  />
                  <MetricBox
                    label="Playoff Impact"
                    value={`${formatNumber(selectedDetails.playoffImpactPercentage, 2)}%`}
                  />
                  <MetricBox
                    label="Best Case"
                    value={`${formatNumber(selectedDetails.bestCaseScenario, 1)}%`}
                  />
                  <MetricBox
                    label="Worst Case"
                    value={`${formatNumber(selectedDetails.worstCaseScenario, 1)}%`}
                  />
                  <MetricBox
                    label="Expected Impact"
                    value={formatNumber(selectedDetails.expectedImpact, 1)}
                  />
                  <MetricBox
                    label="TSI"
                    value={formatNumber(selectedDetails.tsi, 1)}
                  />
                </div>

                <div style={styles.breakdownCard}>
                  <h3 style={styles.breakdownTitle}>Pressure Breakdown</h3>
                  <BreakdownRow label="Record Pressure" value={selectedDetails.breakdown?.recordPressure} />
                  <BreakdownRow label="TSI Pressure" value={selectedDetails.breakdown?.tsiPressure} />
                  <BreakdownRow label="Divisional Pressure" value={selectedDetails.breakdown?.divisionalPressure} />
                  <BreakdownRow label="Conference Pressure" value={selectedDetails.breakdown?.conferencePressure} />
                  <BreakdownRow label="Cowboys NFC Rank" value={selectedDetails.breakdown?.nfcRankOfCowboys} />
                </div>

                <div style={styles.noteBox}>
                  This page is now aligned to the deterministic backend contract.
                  Synthetic UI controls were removed.
                </div>
              </>
            )}
          </div>

          <div style={styles.detailCard}>
            <h2 style={styles.sectionTitle}>Summary</h2>
            <SummaryRow
              label="Highest Impact Team"
              value={summary.highestImpactTeam?.teamName || "--"}
            />
            <SummaryRow
              label="Top Direct Rival"
              value={summary.topDirectRival?.teamName || "--"}
            />
            <SummaryRow
              label="Top Conference Threat"
              value={summary.topConferenceThreat?.teamName || "--"}
            />
            <SummaryRow
              label="Stronger NFC Teams"
              value={summary.strongerNfcTeamCount ?? "--"}
            />
            <div style={styles.summaryNarrative}>
              {summary.narrative || "No summary available."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div style={styles.metricMini}>
      <div style={styles.metricMiniLabel}>{label}</div>
      <div style={styles.metricMiniValue}>{value}</div>
    </div>
  );
}

function BreakdownRow({ label, value }) {
  return (
    <div style={styles.breakdownRow}>
      <span>{label}</span>
      <strong>{value ?? "--"}</strong>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={styles.summaryRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNumber(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

function getUrgencyColor(urgency) {
  switch (urgency) {
    case "critical":
      return "#dc2626";
    case "high":
      return "#f59e0b";
    case "medium":
      return "#3b82f6";
    default:
      return "#64748b";
  }
}

function getTierColor(tier) {
  switch (tier) {
    case "direct_rival":
      return "#dc2626";
    case "threat":
      return "#ea580c";
    default:
      return "#0891b2";
  }
}

function badgeStyle(color) {
  return {
    display: "inline-block",
    padding: "0.35rem 0.6rem",
    borderRadius: "999px",
    background: `${color}22`,
    color,
    fontWeight: 700,
    fontSize: "0.8rem"
  };
}

function sortButtonStyle(active) {
  return {
    padding: "0.55rem 0.8rem",
    background: active ? "#2563eb" : "#0f172a",
    color: active ? "#fff" : "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem"
  };
}

const styles = {
  page: {
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#e5e7eb"
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px"
  },
  heroActions: {
    display: "flex",
    gap: "10px"
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    color: "#f8fafc"
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#94a3b8"
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "16px"
  },
  metricCard: {
    background: "rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "18px"
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    marginBottom: "8px"
  },
  metricValue: {
    fontSize: "1.7rem",
    fontWeight: 800,
    color: "#f8fafc"
  },
  metricMini: {
    background: "rgba(2,6,23,0.45)",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: "12px",
    padding: "14px"
  },
  metricMiniLabel: {
    color: "#94a3b8",
    fontSize: "0.8rem",
    marginBottom: "6px"
  },
  metricMiniValue: {
    color: "#f8fafc",
    fontSize: "1.15rem",
    fontWeight: 800
  },
  infoPanel: {
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "18px"
  },
  infoTitle: {
    fontWeight: 800,
    color: "#f8fafc",
    marginBottom: "8px"
  },
  infoList: {
    margin: 0,
    color: "#cbd5e1",
    paddingLeft: "18px"
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.9fr",
    gap: "18px"
  },
  leftColumn: {
    minWidth: 0
  },
  rightColumn: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },
  tableCard: {
    background: "rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "18px"
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    marginBottom: "14px"
  },
  sectionTitle: {
    margin: 0,
    color: "#f8fafc"
  },
  sectionText: {
    marginTop: "6px",
    color: "#94a3b8"
  },
  sortRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px"
  },
  tableWrap: {
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#94a3b8",
    fontSize: "0.8rem",
    borderBottom: "1px solid rgba(148,163,184,0.14)"
  },
  td: {
    padding: "14px 10px",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    color: "#e5e7eb",
    cursor: "pointer"
  },
  tdSub: {
    color: "#94a3b8",
    fontSize: "0.8rem",
    marginTop: "4px"
  },
  row: {
    background: "transparent"
  },
  rowSelected: {
    background: "rgba(59,130,246,0.08)"
  },
  emptyCell: {
    padding: "24px",
    color: "#94a3b8",
    textAlign: "center"
  },
  detailCard: {
    background: "rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "16px",
    padding: "18px"
  },
  detailTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px"
  },
  detailTeam: {
    color: "#f8fafc",
    fontWeight: 800,
    fontSize: "1.2rem"
  },
  detailMeta: {
    color: "#94a3b8",
    marginTop: "6px"
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "16px"
  },
  breakdownCard: {
    background: "rgba(2,6,23,0.42)",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "14px"
  },
  breakdownTitle: {
    marginTop: 0,
    marginBottom: "10px",
    color: "#f8fafc"
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "8px 0",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    color: "#cbd5e1"
  },
  noteBox: {
    background: "rgba(37,99,235,0.08)",
    color: "#bfdbfe",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: "12px",
    padding: "12px 14px"
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    color: "#cbd5e1"
  },
  summaryNarrative: {
    marginTop: "14px",
    color: "#bfdbfe",
    lineHeight: 1.5
  },
  primaryButton: {
    padding: "0.8rem 1.2rem",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700
  },
  secondaryButton: {
    padding: "0.8rem 1.2rem",
    background: "#0f172a",
    color: "#e5e7eb",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700
  },
  errorBox: {
    background: "rgba(127,29,29,0.2)",
    border: "1px solid rgba(248,113,113,0.3)",
    borderRadius: "14px",
    padding: "20px"
  },
  errorTitle: {
    fontWeight: 800,
    color: "#fecaca",
    marginBottom: "8px"
  },
  errorText: {
    color: "#fca5a5",
    marginBottom: "14px"
  },
  inlineWarning: {
    background: "rgba(127,29,29,0.2)",
    color: "#fecaca",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "12px",
    padding: "12px 14px",
    marginBottom: "14px"
  },
  warningCard: {
    marginTop: "18px",
    background: "rgba(120,53,15,0.18)",
    border: "1px solid rgba(251,191,36,0.2)",
    borderRadius: "14px",
    padding: "16px"
  },
  warningTitle: {
    marginTop: 0,
    color: "#fde68a"
  },
  warningList: {
    marginBottom: 0,
    color: "#fcd34d"
  },
  panel: {
    background: "rgba(15,23,42,0.75)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "14px",
    padding: "18px"
  },
  skeletonBar: {
    height: "16px",
    borderRadius: "10px",
    background: "rgba(148,163,184,0.16)",
    marginBottom: "12px",
    width: "100%"
  }
};

window.RivalTeamImpactPage = RivalTeamImpactPage;
