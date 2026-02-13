/**
 * RivalTeamImpactVisual.jsx
 * Visualizes how different teams' outcomes impact the Cowboys' playoff chances
 * Features:
 * - Cross-team dependency analysis
 * - Impact ranking of future games
 * - Playoff scenario modeling
 */

function RivalTeamImpactVisual({ year = 2025 }) {
  const [loading, setLoading] = React.useState(true);
  const [rivalImpacts, setRivalImpacts] = React.useState([]);
  const [rankedGames, setRankedGames] = React.useState([]);
  const [selectedTeam, setSelectedTeam] = React.useState(null);
  const [cowboysProb, setCowboysProb] = React.useState(50);
  const [scenario, setScenario] = React.useState(null);

  // Initialize the impact analysis
  React.useEffect(() => {
    analyzeRivalImpact();
  }, [year, scenario]);

  const analyzeRivalImpact = async () => {
    try {
      setLoading(true);

      // Key AFC/NFC rivals and teams in Cowboys' playoff picture
      const rivalTeams = [
        "PHI", // Eagles - division rival
        "WAS", // Commanders - division rival
        "NYG", // Giants - division rival
        "SF",  // 49ers - NFC rival
        "TB",  // Buccaneers - NFC South
        "NO",  // Saints - NFC South
        "ATL", // Falcons - NFC South
        "LAR", // Rams - NFC West
        "SEA", // Seahawks - NFC West
        "KC",  // Chiefs - AFC threat
        "BUF", // Bills - AFC threat
        "MIA", // Dolphins - AFC East
        "BAL", // Ravens - AFC North
      ];

      // Fetch schedule and TSI for rival teams
      const teamDataPromises = rivalTeams.map(async (team) => {
        try {
          const [scheduleRes, tsiRes] = await Promise.all([
            fetch(`${getBaseUrl()}/api/cowboys/schedule?year=${year}&team=${team}`),
            fetch(
              `${getBaseUrl()}/api/analytics/tsi?team=${team}&year=${year}`
            ),
          ]);

          const schedule = scheduleRes.ok ? await scheduleRes.json() : [];
          const tsi = tsiRes.ok ? await tsiRes.json() : null;

          return { team, schedule, tsi };
        } catch (error) {
          console.error(`Failed to fetch data for ${team}:`, error);
          return { team, schedule: [], tsi: null };
        }
      });

      const teamDataResults = await Promise.all(teamDataPromises);

      // Get Cowboys' current playoff probability
      const cowboysData = await window.api.getTSI("DAL", year);
      const baselineProb = await calculateCowboysProbability();

      // Analyze impact of each team's outcomes
      const impacts = analyzeTeamOutcomeImpacts(
        teamDataResults,
        baselineProb,
        scenario
      );

      // Rank games by impact potential
      const ranked = rankGamesByImpact(impacts);

      setRivalImpacts(impacts);
      setRankedGames(ranked);
      setCowboysProb(baselineProb);
    } catch (error) {
      console.error("Error analyzing rival impacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBaseUrl = () => {
    return window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : window.location.origin;
  };

  const calculateCowboysProbability = async () => {
    try {
      const result = await window.api.getTSI("DAL", year);
      // Estimate playoff probability from TSI and schedule strength
      const baseProbability = Math.min(
        95,
        Math.max(10, (result.tsi / 100) * 90 + 15)
      );
      return Math.round(baseProbability);
    } catch (error) {
      console.error("Error calculating Cowboys probability:", error);
      return 50;
    }
  };

  const analyzeTeamOutcomeImpacts = (teamData, baselineProb, scenario) => {
    return teamData
      .map(({ team, schedule, tsi }) => {
        // Identify remaining games
        const remainingGames = schedule.filter((game) => !game.completed);

        // Calculate opponent impact score
        const opponentImportance = calculateOpponentImportance(team, tsi);

        // Determine competitive tier
        const tier = determineTier(team, tsi);

        // Calculate win probability for the team
        const teamWinProb = calculateTeamWinProbability(team, tsi, scenario);

        // Estimate impact on Cowboys
        const cowboysImpact = estimateCowboysImpact(
          team,
          tier,
          teamWinProb,
          baselineProb
        );

        return {
          team,
          tier,
          teamName: getTeamName(team),
          tsi: tsi?.tsi || 50,
          remainingGames: remainingGames.length,
          winProbability: Math.round(teamWinProb * 100),
          opponentImportance,
          nextGame: remainingGames[0],
          cowboysImpactScore: cowboysImpact.impactScore,
          cowboysPlayoffEffect: cowboysImpact.playoffEffect,
          recommendedOutcome: cowboysImpact.recommendedOutcome,
          urgency: cowboysImpact.urgency,
          keyMetrics: {
            strengthRating: tsi?.tsi || 50,
            scheduleStrength: tsi?.components?.schedule || 45,
            relevance: tier === "direct_rival" ? 10 : tier === "threat" ? 8 : 5,
          },
        };
      })
      .filter((impact) => impact.remainingGames > 0)
      .sort((a, b) => b.cowboysImpactScore - a.cowboysImpactScore);
  };

  const calculateOpponentImportance = (team, tsi) => {
    if (!tsi) return 50;
    // Higher-rated teams are more important in the playoff race
    return Math.min(100, Math.max(20, (tsi.tsi / 100) * 100));
  };

  const determineTier = (team, tsi) => {
    const directRivals = ["PHI", "WAS", "NYG"];
    const threats = ["SF", "TB", "KC", "BUF"];

    if (directRivals.includes(team)) return "direct_rival";
    if (threats.includes(team)) return "threat";
    return "wildcard_contender";
  };

  const calculateTeamWinProbability = (team, tsi, scenario) => {
    if (!tsi) return 0.5;

    let baseWinProb = tsi.tsi / 100;

    if (scenario === "strong_rivals") {
      // Rivals are more likely to win in this scenario
      baseWinProb = Math.min(1, baseWinProb * 1.15);
    } else if (scenario === "weak_rivals") {
      baseWinProb = Math.max(0.3, baseWinProb * 0.85);
    }

    return baseWinProb;
  };

  const estimateCowboysImpact = (team, tier, rivalWinProb, baselineProb) => {
    let impactScore = 0;
    let playoffEffect = 0;
    let recommendedOutcome = "Loss";

    if (tier === "direct_rival") {
      // Division rival - their win directly hurts Cowboys' division positioning
      impactScore = 95;
      playoffEffect = 3; // Impact % on playoff chances
      recommendedOutcome = "Loss";
    } else if (tier === "threat") {
      // Conference threat - affects playoff seeding/wildcard chances
      impactScore = 75;
      playoffEffect = 2;
      recommendedOutcome = "Loss";
    } else {
      // Wildcard contenders - moderate impact
      impactScore = 45;
      playoffEffect = 1;
      recommendedOutcome = "Loss";
    }

    // Adjust based on actual win probability
    impactScore = impactScore * Math.min(1, rivalWinProb + 0.3);

    const urgency =
      impactScore > 80 ? "critical" : impactScore > 50 ? "high" : "medium";

    return {
      impactScore: Math.round(impactScore),
      playoffEffect,
      recommendedOutcome,
      urgency,
    };
  };

  const rankGamesByImpact = (impacts) => {
    const games = [];

    impacts.forEach((impact) => {
      if (impact.nextGame) {
        games.push({
          ...impact,
          gameDate: impact.nextGame.date,
          opponent: impact.nextGame.opponent,
          playingAt: impact.nextGame.home ? "Home" : "Away",
          impactRank: 0, // Will be assigned below
        });
      }
    });

    // Sort by impact score and assign ranks
    games.sort((a, b) => b.cowboysImpactScore - a.cowboysImpactScore);
    games.forEach((game, index) => {
      game.impactRank = index + 1;
    });

    return games;
  };

  const getTeamName = (teamCode) => {
    const teamNames = {
      DAL: "Cowboys",
      PHI: "Eagles",
      WAS: "Commanders",
      NYG: "Giants",
      SF: "49ers",
      TB: "Buccaneers",
      NO: "Saints",
      ATL: "Falcons",
      LAR: "Rams",
      SEA: "Seahawks",
      KC: "Chiefs",
      BUF: "Bills",
      MIA: "Dolphins",
      BAL: "Ravens",
    };
    return teamNames[teamCode] || teamCode;
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case "direct_rival":
        return "#dc2626";
      case "threat":
        return "#ea580c";
      default:
        return "#0891b2";
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case "critical":
        return "#dc2626";
      case "high":
        return "#f59e0b";
      default:
        return "#3b82f6";
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="eyebrow">Rival Team Impact Analyzer</div>
        <p style={{ textAlign: "center", color: "#666" }}>
          Analyzing cross-team dependencies...
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowY: "auto", maxHeight: "600px" }}>
      <div className="eyebrow">Rival Team Impact Analyzer</div>
      <h3 style={{ marginTop: 0 }}>
        Games Cowboys Fans Should Root For
        <span style={{ fontSize: "0.7em", fontWeight: "normal", color: "#666" }}>
          {" "}
          (Impact Ranking)
        </span>
      </h3>

      {/* Quick Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#f0f9ff",
            padding: "0.75rem",
            borderRadius: "6px",
            borderLeft: "4px solid #0284c7",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "4px" }}>
            Cowboys Playoff %
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0284c7" }}>
            {cowboysProb}%
          </div>
        </div>
        <div
          style={{
            background: "#fef3c7",
            padding: "0.75rem",
            borderRadius: "6px",
            borderLeft: "4px solid #d97706",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "4px" }}>
            Teams Being Tracked
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#d97706" }}>
            {rivalImpacts.length}
          </div>
        </div>
      </div>

      {/* Scenario Filter */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "#666",
            marginRight: "0.5rem",
          }}
        >
          Scenario:
        </label>
        <select
          value={scenario || ""}
          onChange={(e) => setScenario(e.target.value || null)}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: "4px",
            border: "1px solid #e5e7eb",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          <option value="">Baseline</option>
          <option value="strong_rivals">Strong Rivals Scenario</option>
          <option value="weak_rivals">Weak Rivals Scenario</option>
        </select>
      </div>

      {/* Ranked Games */}
      <div style={{ marginTop: "1.5rem" }}>
        <h4 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "#1f2937" }}>
          Top Games to Watch
        </h4>

        {rankedGames.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", padding: "1rem" }}>
            No upcoming games found. Season may be over.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {rankedGames.slice(0, 8).map((game, index) => (
              <div
                key={`${game.team}-${index}`}
                onClick={() => setSelectedTeam(game.team)}
                style={{
                  background: selectedTeam === game.team ? "#f0f9ff" : "#fff",
                  border:
                    selectedTeam === game.team
                      ? "2px solid #0284c7"
                      : "1px solid #e5e7eb",
                  borderLeft: `5px solid ${getUrgencyColor(game.urgency)}`,
                  padding: "0.75rem",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                }}
              >
                {/* Rank Badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: getUrgencyColor(game.urgency),
                    color: "#fff",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                  }}
                >
                  #{game.impactRank}
                </div>

                <div style={{ marginRight: "40px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background: getTierColor(game.tier),
                        color: "#fff",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "3px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {game.tier === "direct_rival"
                        ? "Division"
                        : game.tier === "threat"
                        ? "Threat"
                        : "Contender"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#1f2937",
                      }}
                    >
                      {game.teamName}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#999" }}>
                      vs {game.opponent}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "0.5rem",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#666" }}>Impact:</strong>{" "}
                      <span
                        style={{
                          fontWeight: 700,
                          color: getUrgencyColor(game.urgency),
                        }}
                      >
                        {game.cowboysImpactScore}
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: "#666" }}>Root for:</strong>{" "}
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            game.recommendedOutcome === "Loss"
                              ? "#dc2626"
                              : "#059669",
                        }}
                      >
                        {game.recommendedOutcome}
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: "#666" }}>Win %:</strong>{" "}
                      <span style={{ fontWeight: 700, color: "#0891b2" }}>
                        {game.winProbability}%
                      </span>
                    </div>
                  </div>

                  {game.gameDate && (
                    <div
                      style={{
                        marginTop: "0.4rem",
                        fontSize: "0.75rem",
                        color: "#999",
                      }}
                    >
                      📅 {new Date(game.gameDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Impact Analysis Summary */}
      <div
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "#f5f3ff",
          borderRadius: "6px",
          borderLeft: "4px solid #8b5cf6",
          fontSize: "0.85rem",
        }}
      >
        <strong style={{ color: "#6d28d9" }}>How It Works:</strong>
        <ul
          style={{
            margin: "0.5rem 0 0 1.5rem",
            paddingLeft: "0",
            fontSize: "0.8rem",
          }}
        >
          <li>
            <strong>Impact Score</strong>: How much this game affects Cowboys'
            playoff odds (0-100)
          </li>
          <li>
            <strong>Division Rivals</strong>: Direct impact on playoff seeding
          </li>
          <li>
            <strong>Threats</strong>: Conference rivals competing for playoff
            spots
          </li>
          <li>
            <strong>Urgency</strong>: Critical vs High vs Medium importance
          </li>
        </ul>
      </div>
    </div>
  );
}
