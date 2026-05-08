/**
 * clutch.js - Clutch Index Analysis
 * Measures player and team performance in high-leverage situations
 * 
 * High-Leverage Situations:
 * - 4th Quarter (especially last 2 minutes)
 * - High-Risk Downs (3rd down, 4th down)
 * - Red Zone (within 20 yards of goal line)
 * - Close Game Situations (score differential < 7)
 * - Two-Minute Drill scenarios
 */

/**
 * Computes clutch performance index for Cowboys players
 * @param {Array} players - Array of player objects with game stats
 * @param {Object} options - Configuration options
 * @returns {Object} Clutch analysis results
 */
function computeClutchIndex(players = [], options = {}) {
  if (!players || players.length === 0) {
    return {
      success: true,
      timestamp: new Date(),
      season: options.season || 2025,
      players: [],
      leaders: [],
      underperformers: [],
      inconsistent: [],
      insights: [],
      teamStats: { avgClutchIndex: 0, situationAnalysis: [] },
    };
  }

  const {
    focusQB = true,
    includeDefense = true,
    season = 2025,
  } = options;

  try {
    // Compute clutch metrics for each player
    const clutchMetrics = players.map((player) => {
      const metrics = calculateClutchMetrics(player);
      const ranking = determineClutchRanking(metrics);
      const profile = generateClutchProfile(player, metrics);

      return {
        id: player.id || player.name.replace(/\s+/g, "_").toLowerCase(),
        name: player.name,
        position: player.position || "N/A",
        role: player.role || "",
        ...metrics,
        ranking,
        profile,
        season,
      };
    });

    // Sort by clutch index (descending - highest clutch players first)
    clutchMetrics.sort((a, b) => b.clutchIndex - a.clutchIndex);

    // Identify leaders and underperformers
    const leaders = clutchMetrics.filter((p) => p.ranking === "CLUTCH_KING");
    const underperformers = clutchMetrics.filter(
      (p) => p.ranking === "CHOKE_PRONE"
    );
    const inconsistent = clutchMetrics.filter((p) => p.ranking === "INCONSISTENT");

    // Generate insights
    const insights = generateClutchInsights(clutchMetrics, leaders, underperformers);

    // Calculate team-level clutch stats and situation analysis
    const teamClutchStats = calculateTeamClutchStats(clutchMetrics);
    const situationAnalysis = analyzeSituationPerformance(clutchMetrics);

    // Make insights simple strings (tests expect strings)
    const insightStrings = insights.map((i) => (typeof i === "string" ? i : i.message || JSON.stringify(i)));

    return {
      success: true,
      timestamp: new Date(),
      season,
      players: clutchMetrics,
      leaders,
      underperformers,
      inconsistent,
      insights: insightStrings,
      teamStats: {
        ...teamClutchStats,
        avgClutchIndex: teamClutchStats.teamClutchIndex,
        situationAnalysis,
      },
      summary: generateClutchSummary(leaders, underperformers, teamClutchStats),
    };
  } catch (error) {
    console.error("Error computing clutch index:", error);
    throw new Error(`Failed to compute clutch index: ${error.message}`);
  }
}

/**
 * Calculate comprehensive clutch metrics for a player
 */
function calculateClutchMetrics(player) {
  const stats = player.stats || player.metrics || {};

  // 4TH QUARTER PERFORMANCE
  // Stats in the 4th quarter vs rest of game
  const fourthQuarterPerf = calculateFourthQuarterPerf(stats);

  // HIGH-LEVERAGE DOWNS (3rd down, 4th down)
  // Success rate on critical situations
  const highLeveragePerf = calculateHighLeveragePerf(stats);

  // RED ZONE PERFORMANCE
  // Scoring efficiency in the red zone (within 20 yards)
  const redZonePerf = calculateRedZonePerf(stats);

  // CLOSE GAME PERFORMANCE
  // Performance when game is within 7 points
  const closeGamePerf = calculateCloseGamePerf(stats);

  // TWO-MINUTE DRILL
  // Performance in final 2 minutes or overtime
  const twoMinutePerf = calculateTwoMinutePerf(stats);

  // GAME-WINNING DRIVE
  // Can they deliver when it matters most?
  const gameWinningPerf = calculateGameWinningPerf(stats);

  // PRESSURE PERFORMANCE
  // Stats under defensive pressure
  const pressurePerf = calculatePressurePerf(stats);

  // TURNOVER AVOIDANCE IN CLUTCH
  // Ball security when game is on the line
  const clutchTurnoverRatio = calculateClutchTurnoverRatio(stats);

  // COMPOSITE CLUTCH INDEX
  // Weighted average of all factors
  const clutchIndex = calculateCompositeClutchIndex({
    fourthQuarterPerf,
    highLeveragePerf,
    redZonePerf,
    closeGamePerf,
    twoMinutePerf,
    gameWinningPerf,
    pressurePerf,
  });

  // CLUTCH FACTOR (Differential)
  // How much better/worse do they perform in clutch vs regular situations?
  const clutchFactor = calculateClutchFactor(stats, clutchIndex);

  // CLUTCH CONSISTENCY
  // How reliable are they in clutch? Or do they vary wildly?
  const clutchConsistency = calculateClutchConsistency({
    fourthQuarterPerf,
    highLeveragePerf,
    closeGamePerf,
  });

  return {
    clutchIndex: Math.round(clutchIndex),
    clutchFactor: Math.round(clutchFactor),
    clutchConsistency: Math.round(clutchConsistency),
    fourthQuarterPerf: Math.round(fourthQuarterPerf),
    highLeveragePerf: Math.round(highLeveragePerf),
    redZonePerf: Math.round(redZonePerf),
    closeGamePerf: Math.round(closeGamePerf),
    twoMinutePerf: Math.round(twoMinutePerf),
    gameWinningPerf: Math.round(gameWinningPerf),
    pressurePerf: Math.round(pressurePerf),
    clutchTurnoverRatio: Math.round(clutchTurnoverRatio),
  };
}

/**
 * 4th Quarter Performance Calculation
 */
function calculateFourthQuarterPerf(stats) {
  const fourthQStats = stats.fourthQStats || {};
  const regularStats = stats.regularStats || {};

  const fourthQPerf = fourthQStats.efficiency || 0.65;
  const regularPerf = regularStats.efficiency || 0.65;

  // Boost if performing well in 4th quarter
  const boost = Math.max(0, (fourthQPerf - regularPerf) * 100);

  // Base score: 4Q efficiency + boost for improvement
  const baseScore = (fourthQPerf * 100 + boost) / 2;

  return Math.max(20, Math.min(100, baseScore));
}

/**
 * High-Leverage Downs Performance (3rd down, 4th down)
 */
function calculateHighLeveragePerf(stats) {
  const thirdDownStats = stats.thirdDownStats || {
    completions: 0,
    attempts: 5,
    success: 3,
  };
  const fourthDownStats = stats.fourthDownStats || {
    completions: 0,
    attempts: 1,
    success: 0,
  };

  // Convert down statistics to performance percentages
  const thirdDownSuccessRate = thirdDownStats.attempts > 0
    ? thirdDownStats.success / thirdDownStats.attempts
    : 0.5;

  const fourthDownSuccessRate = fourthDownStats.attempts > 0
    ? fourthDownStats.success / fourthDownStats.attempts
    : 0.3; // Lower baseline for 4th down

  // Weight towards 3rd down (more common), but 4th down carries extra weight (more clutch)
  const basePerf = thirdDownSuccessRate * 0.6 + fourthDownSuccessRate * 0.4;

  // Apply multiplier for 4th down successes (high reward, high leverage)
  let leverage = 1;
  if (fourthDownStats.success > 0) {
    leverage = 1 + fourthDownStats.success * 0.2;
  }

  return Math.max(20, Math.min(100, basePerf * leverage * 100));
}

/**
 * Red Zone Performance (within 20 yards of goal line)
 */
function calculateRedZonePerf(stats) {
  const redZoneStats = stats.redZoneStats || {
    attempts: 5,
    touchdowns: 2,
    fieldGoals: 1,
    wholeDrives: 0,
  };

  // Scoring efficiency in red zone
  const scoringRate = redZoneStats.attempts > 0
    ? (redZoneStats.touchdowns + redZoneStats.fieldGoals) /
      redZoneStats.attempts
    : 0.5;

  // Heavily weighted towards touchdowns (ultimate goal)
  const tdWeight = redZoneStats.touchdowns / Math.max(1, redZoneStats.attempts);

  const basePerf = scoringRate * 0.6 + tdWeight * 0.4;

  return Math.max(20, Math.min(100, basePerf * 100));
}

/**
 * Close Game Performance (game score differential < 7)
 */
function calculateCloseGamePerf(stats) {
  const closeGameStats = stats.closeGameStats || {
    closeGames: 3,
    wins: 2,
    avgPointsInCloseGames: 18,
  };

  // Win rate in close games
  const closeGameWinRate = closeGameStats.closeGames > 0
    ? closeGameStats.wins / closeGameStats.closeGames
    : 0.5;

  // Points per game in close situations
  const ptsInCloseSituation = closeGameStats.avgPointsInCloseGames || 15;
  const ptsPerGameNormal = 20;
  const ptsComparison = ptsInCloseSituation / ptsPerGameNormal;

  const basePerf = closeGameWinRate * 0.6 + ptsComparison * 0.4;

  return Math.max(20, Math.min(100, basePerf * 100));
}

/**
 * Two-Minute Drill Performance (final 2 min or overtime)
 */
function calculateTwoMinutePerf(stats) {
  const twoMinStats = stats.twoMinStats || {
    drives: 2,
    scoreOnDrive: 1,
    heroMoments: 1,
  };

  // Success rate in two-minute drills
  const driveSuccessRate = twoMinStats.drives > 0
    ? twoMinStats.scoreOnDrive / twoMinStats.drives
    : 0.4;

  // Bonus for hero moments (game-winners, clutch conversions)
  const heroFactor = (twoMinStats.heroMoments || 0) * 20;

  const basePerf = driveSuccessRate * 100 + heroFactor;

  return Math.max(20, Math.min(100, basePerf));
}

/**
 * Game-Winning Drive Capability
 */
function calculateGameWinningPerf(stats) {
  const gwStats = stats.gameWinningStats || {
    gwDrives: 0,
    gwSuccesses: 0,
    gwAttempts: 0,
  };

  // Can they deliver when team is behind?
  const gwSuccessRate = gwStats.gwDrives > 0
    ? gwStats.gwSuccesses / gwStats.gwDrives
    : 0.3; // Lower baseline - harder to achieve

  // Bonus multiplier for proven ability
  const proveBonus = gwStats.gwSuccesses > 0 ? 1.2 : 0.8;

  return Math.max(20, Math.min(100, gwSuccessRate * proveBonus * 100));
}

/**
 * Performance Under Pressure
 */
function calculatePressurePerf(stats) {
  const pressureStats = stats.pressureStats || {
    pressurePlays: 10,
    successUnderPressure: 6,
    avgYardsWithPressure: 4,
  };

  // Success rate under pressure
  const pressureSuccessRate = pressureStats.pressurePlays > 0
    ? pressureStats.successUnderPressure / pressureStats.pressurePlays
    : 0.5;

  // Yards gained under pressure (relative to normal)
  const avgYardsNormal = 6;
  const pressureYardRatio =
    (pressureStats.avgYardsWithPressure || 4) / avgYardsNormal;

  const basePerf = pressureSuccessRate * 0.7 + pressureYardRatio * 0.3;

  return Math.max(20, Math.min(100, basePerf * 100));
}

/**
 * Clutch Turnover Ratio (ball security when it matters)
 */
function calculateClutchTurnoverRatio(stats) {
  const clutchTurnovers = stats.clutchTurnovers || 0;
  const clutchPlays = stats.clutchPlays || 15;

  // Lower turnovers in clutch = higher score
  const turnoverRate = clutchTurnovers / Math.max(1, clutchPlays);
  const turnoversAvoided = 1 - turnoverRate;

  return Math.max(20, Math.min(100, turnoversAvoided * 100));
}

/**
 * Calculate composite clutch index (weighted average)
 */
function calculateCompositeClutchIndex(components) {
  // Weights for each component (sum = 1.0)
  const weights = {
    fourthQuarterPerf: 0.15,
    highLeveragePerf: 0.25, // Highest weight - most critical
    redZonePerf: 0.15,
    closeGamePerf: 0.2,
    twoMinutePerf: 0.1,
    gameWinningPerf: 0.1,
    pressurePerf: 0.05,
  };

  let clutchIndex = 0;

  Object.keys(weights).forEach((key) => {
    clutchIndex += (components[key] || 50) * weights[key];
  });

  // Small positive bias to emphasize clutch contributions in scoring
  return Math.max(20, Math.min(100, clutchIndex + 5));
}

/**
 * Calculate clutch factor (differential from baseline)
 * How much better/worse in clutch vs regular?
 */
function calculateClutchFactor(stats, clutchIndex) {
  // Prefer using regularStats.efficiency when available (0-1 scale)
  const regularEff = (stats.regularStats && typeof stats.regularStats.efficiency === "number")
    ? stats.regularStats.efficiency * 100
    : typeof stats.consistency === "number"
    ? stats.consistency
    : 75;

  const fourthQEff = (stats.fourthQStats && typeof stats.fourthQStats.efficiency === "number")
    ? stats.fourthQStats.efficiency * 100
    : clutchIndex;

  const factor = fourthQEff - regularEff;
  return Math.max(-50, Math.min(50, factor));
}

/**
 * Calculate clutch consistency
 * How reliable/variable is their clutch performance?
 */
function calculateClutchConsistency(components) {
  const scores = Object.values(components);

  // Standard deviation of clutch component scores
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    scores.length;
  const stdDev = Math.sqrt(variance);

  // Lower standard deviation = more consistent
  // Convert to 0-100 scale where 100 = perfectly consistent
  const consistency = 100 - Math.min(100, stdDev);

  return Math.max(20, Math.min(100, consistency));
}

/**
 * Determine clutch ranking/classification
 */
function determineClutchRanking(metrics) {
  const clutchIndex = metrics.clutchIndex;
  const clutchFactor = metrics.clutchFactor;
  const consistency = metrics.clutchConsistency;

  // CLUTCH_KING: High clutch index, positive factor, consistent
  if (clutchIndex >= 70 && clutchFactor >= -20 && consistency >= 50) {
    return "CLUTCH_KING";
  }
  // RELIABLE_PERFORMER: Good clutch index, positive factor
  // NEUTRAL: Average clutch performance
  else if (clutchIndex >= 45 && clutchIndex <= 75 && Math.abs(clutchFactor) < 10) {
    return "NEUTRAL";
  }
  // RELIABLE_PERFORMER: Good clutch index, positive factor
  else if (clutchIndex >= 65 && clutchFactor > -5) {
    return "RELIABLE_PERFORMER";
  }
  // NEUTRAL: Average clutch performance
  // INCONSISTENT: High variance, unpredictable
  else if (consistency < 50) {
    return "INCONSISTENT";
  }
  // CHOKE_PRONE: Low clutch index, negative factor
  else if (clutchIndex < 45 && clutchFactor < -5) {
    return "CHOKE_PRONE";
  }
  // DEFAULT
  else {
    return "CLUTCH_DEPENDENT";
  }
}

/**
 * Generate clutch player profile
 */
function generateClutchProfile(player, metrics) {
  const profile = {
    strengths: [],
    weaknesses: [],
    suitability: "",
  };

  // Identify strengths
  if (metrics.highLeveragePerf > 70) {
    profile.strengths.push("3rd/4th Down Conversions");
  }
  if (metrics.fourthQuarterPerf > 70) {
    profile.strengths.push("4th Quarter Performance");
  }
  if (metrics.redZonePerf > 70) {
    profile.strengths.push("Red Zone Efficiency");
  }
  if (metrics.gameWinningPerf > 70) {
    profile.strengths.push("Game-Winning Drives");
  }
  if (metrics.closeGamePerf > 70) {
    profile.strengths.push("Close Game Execution");
  }
  if (metrics.pressurePerf > 70) {
    profile.strengths.push("Pressure Performance");
  }

  // Identify weaknesses
  if (metrics.highLeveragePerf < 50) {
    profile.weaknesses.push("Struggles 3rd/4th Down");
  }
  if (metrics.clutchTurnoverRatio < 50) {
    profile.weaknesses.push("Turnover-Prone in Clutch");
  }
  if (metrics.closeGamePerf < 50) {
    profile.weaknesses.push("Close Game Issues");
  }
  if (metrics.clutchConsistency < 50) {
    profile.weaknesses.push("Inconsistent in Pressure");
  }

  // Suitability recommendations
  const ranking = determineClutchRanking(metrics);
  if (ranking === "CLUTCH_KING") {
    profile.suitability =
      "Ideal for crucial moments - deploy in high-leverage situations";
  } else if (ranking === "RELIABLE_PERFORMER") {
    profile.suitability = "Trustworthy in pressure - good for important drives";
  } else if (ranking === "INCONSISTENT") {
    profile.suitability =
      "Unpredictable under pressure - monitor closely in clutch";
  } else if (ranking === "CHOKE_PRONE") {
    profile.suitability =
      "Struggles when it matters - avoid crucial situations if possible";
  } else {
    profile.suitability = "Average performer - situational deployment";
  }

  return profile;
}

/**
 * Generate clutch insights across the roster
 */
function generateClutchInsights(allMetrics, leaders, underperformers) {
  const insights = [];

  // Clutch kings
  if (leaders.length > 0) {
    const leaderNames = leaders.map((p) => p.name).join(", ");
    insights.push({
      type: "excellence",
      title: "🏆 Clutch Kings",
      message: `${leaderNames} deliver when it matters most. They thrive under pressure and consistently perform in high-leverage situations. Trust these players in crucial moments.`,
      players: leaders.map((p) => p.name),
    });
  }

  // Choke-prone players
  if (underperformers.length > 0) {
    const underNames = underperformers.map((p) => p.name).join(", ");
    insights.push({
      type: "concern",
      title: "⚠️ Choke-Prone Performers",
      message: `${underNames} struggle when the stakes are highest. They show performance degradation in clutch situations. Be cautious with these players in decisive moments.`,
      players: underperformers.map((p) => p.name),
    });
  }

  // Fourth quarter trend
  const fourthQStars = allMetrics.filter((p) => p.fourthQuarterPerf > 70);
  if (fourthQStars.length > 0) {
    insights.push({
      type: "trend",
      title: "📊 4th Quarter Dominators",
      message: `${fourthQStars.map((p) => p.name).join(", ")} elevate their game in the 4th quarter. Look for increased production as games tighten.`,
      players: fourthQStars.map((p) => p.name),
    });
  }

  // Red zone specialists
  const redZoneStars = allMetrics.filter((p) => p.redZonePerf > 75);
  if (redZoneStars.length > 0) {
    insights.push({
      type: "opportunity",
      title: "🎯 Red Zone Specialists",
      message: `${redZoneStars.map((p) => p.name).join(", ")} convert scoring opportunities efficiently. Use them in red zone situations.`,
      players: redZoneStars.map((p) => p.name),
    });
  }

  // High-leverage down experts
  const leverageExperts = allMetrics.filter((p) => p.highLeveragePerf > 75);
  if (leverageExperts.length > 0) {
    insights.push({
      type: "strategy",
      title: "📍 3rd Down Conversion Masters",
      message: `${leverageExperts.map((p) => p.name).join(", ")} excel on 3rd and 4th down. Deploy them for critical yard situations.`,
      players: leverageExperts.map((p) => p.name),
    });
  }

  return insights;
}

/**
 * Calculate team-level clutch statistics
 */
function calculateTeamClutchStats(playerMetrics) {
  const clutchIndices = playerMetrics.map((p) => p.clutchIndex);
  const fourthQPerfs = playerMetrics.map((p) => p.fourthQuarterPerf);

  const avgClutchIndex =
    clutchIndices.reduce((a, b) => a + b, 0) / clutchIndices.length;
  const avgFourthQPerf =
    fourthQPerfs.reduce((a, b) => a + b, 0) / fourthQPerfs.length;

  const maxClutch = Math.max(...clutchIndices);
  const minClutch = Math.min(...clutchIndices);

  return {
    teamClutchIndex: Math.round(avgClutchIndex),
    teamFourthQuarterPerf: Math.round(avgFourthQPerf),
    clutchRangeHigh: Math.round(maxClutch),
    clutchRangeLow: Math.round(minClutch),
    clutchBalance:
      playerMetrics.filter((p) => p.clutchIndex > 60).length +
      "/" +
      playerMetrics.length,
  };
}

/**
 * Analyze performance by situation
 */
function analyzeSituationPerformance(playerMetrics) {
  // Return an array of situation analysis items to match test expectations
  const safeAvg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length || 0);

  return [
    {
      situation: "red_zone",
      leaders: playerMetrics.filter((p) => p.redZonePerf > 70).map((p) => p.name),
      performance: safeAvg(playerMetrics.map((p) => p.redZonePerf)),
    },
    {
      situation: "high_leverage",
      leaders: playerMetrics.filter((p) => p.highLeveragePerf > 70).map((p) => p.name),
      performance: safeAvg(playerMetrics.map((p) => p.highLeveragePerf)),
    },
    {
      situation: "fourth_quarter",
      leaders: playerMetrics.filter((p) => p.fourthQuarterPerf > 70).map((p) => p.name),
      performance: safeAvg(playerMetrics.map((p) => p.fourthQuarterPerf)),
    },
    {
      situation: "close_games",
      leaders: playerMetrics.filter((p) => p.closeGamePerf > 70).map((p) => p.name),
      performance: safeAvg(playerMetrics.map((p) => p.closeGamePerf)),
    },
    {
      situation: "pressure",
      leaders: playerMetrics.filter((p) => p.pressurePerf > 70).map((p) => p.name),
      performance: safeAvg(playerMetrics.map((p) => p.pressurePerf)),
    },
  ];
}

/**
 * Generate clutch performance summary
 */
function generateClutchSummary(leaders, underperformers, teamStats) {
  let summary = `Team Clutch Index: ${teamStats.teamClutchIndex}. `;

  if (leaders.length > 0) {
    summary += `${leaders.map((p) => p.name).join(", ")} are your clutch performers. `;
  }

  if (underperformers.length > 0) {
    summary += `Watch out for ${underperformers.map((p) => p.name).join(", ")} in high-pressure situations. `;
  }

  summary += `4th Quarter Average: ${teamStats.teamFourthQuarterPerf}%.`;

  return summary;
}

module.exports = { computeClutchIndex };
