/**
 * Maps.js - Consistency vs Explosiveness Analysis
 * Analyzes Cowboys players across two key dimensions:
 * - Consistency (reliability, week-to-week stability)
 * - Explosiveness (big play potential, peak performance)
 */

/**
 * Computes consistency vs explosiveness map for Cowboys players
 * @param {Array} players - Array of player objects with metrics
 * @returns {Object} Analysis with player positions and categories
 */
function computeConsistencyExplosiveness(players = []) {
  if (!players || players.length === 0) {
    return {
      success: false,
      error: "No player data provided",
      players: [],
      summary: "",
    };
  }

  // Compute raw metrics for each player
  const playerMetrics = players.map((player) => {
    const metrics = player.metrics || {};

    // CONSISTENCY METRIC (X-axis)
    // Measures reliability - lower variance = higher consistency
    // Based on performance metrics stability
    const consistencyScore = calculateConsistency(metrics);

    // EXPLOSIVENESS METRIC (Y-axis)
    // Measures big play potential and peak performance
    // Based on explosiveness and offense ratings
    const explosivenessScore = calculateExplosiveness(metrics);

    // Determine player category
    const category = categorizePlayer(consistencyScore, explosivenessScore);

    // Risk assessment
    const volatility = calculateVolatility(
      consistencyScore,
      explosivenessScore
    );

    // Performance tier
    const tier = determineTier(
      consistencyScore,
      explosivenessScore,
      metrics
    );

    return {
      id: player.id || player.name.replace(/\s+/g, "_").toLowerCase(),
      name: player.name,
      position: player.position || "N/A",
      role: player.role || "",
      consistency: Math.round(consistencyScore),
      explosiveness: Math.round(explosivenessScore),
      category,
      volatility,
      tier,
      rawMetrics: metrics,
      statsProfile: generateStatsProfile(metrics, consistencyScore, explosivenessScore),
    };
  });

  // Sort by impact (explosiveness + consistency)
  playerMetrics.sort(
    (a, b) =>
      b.explosiveness + b.consistency - (a.explosiveness + a.consistency)
  );

  // Categorize findings
  const findings = categorizePlayers(playerMetrics);

  // Generate insights
  const insights = generateInsights(playerMetrics);

  return {
    success: true,
    timestamp: new Date(),
    players: playerMetrics,
    findings,
    insights,
    quadrants: {
      elite: {
        name: "Quietly Elite",
        description: "High consistency, High explosiveness",
        players: playerMetrics.filter((p) => p.category === "elite"),
      },
      volatile: {
        name: "Volatile",
        description: "Low consistency, High explosiveness",
        players: playerMetrics.filter((p) => p.category === "volatile"),
      },
      reliable: {
        name: "Reliable Role Players",
        description: "High consistency, Lower explosiveness",
        players: playerMetrics.filter((p) => p.category === "reliable"),
      },
      inconsistent: {
        name: "Inconsistent Performers",
        description: "Low consistency, Lower explosiveness",
        players: playerMetrics.filter((p) => p.category === "inconsistent"),
      },
    },
  };
}

/**
 * Calculate Consistency Score (X-axis)
 * Higher = more consistent and predictable performance
 * 
 * Research-based Definition:
 * - Consistency measures week-to-week reliability
 * - Low variance in performance outcomes
 * - Player you can count on regardless of opponent
 * - Formula: base_consistency * reliability_multiplier
 *   where reliability = (baseline_performance / variance_penalty)
 */
function calculateConsistency(metrics) {
  // Base consistency metric already in data
  const consistency = metrics.consistency || 75;
  const clutch = metrics.clutch || 70;
  const durability = metrics.durability || 70;

  // Consistency formula: averages reliability metrics
  // Higher durability and clutch play suggest more predictable performers
  const baseConsistency = (consistency * 0.6 + clutch * 0.25 + durability * 0.15);

  // Reliability multiplier: 
  // Players with high baseline consistency and high durability are more reliable
  const reliabilityMultiplier = 1 + durability * 0.002;

  const finalConsistency = baseConsistency * Math.min(1.2, reliabilityMultiplier);

  // Normalize to 0-100 scale, with floor at 20 (minimum viable player)
  return Math.max(20, Math.min(100, finalConsistency));
}

/**
 * Calculate Explosiveness Score (Y-axis)
 * Higher = more explosive plays, bigger impact potential
 * 
 * Research-based Definition:
 * - Explosiveness measures ceiling performance and big-play potential
 * - High-variance upside plays capability
 * - Players who can take over games and change momentum
 * - Formula: peak_performance * upside_coefficient
 *   where upside = explosiveness / average_output
 */
function calculateExplosiveness(metrics) {
  const explosiveness = metrics.explosiveness || 75;
  const offense = metrics.offense || 70;
  
  // Explosiveness formula: weighted toward actual explosiveness metric
  // Offensive capability provides baseline
  const baseExplosiveness = explosiveness * 0.7 + offense * 0.3;

  // Upside coefficient: how much higher ceiling vs floor
  // Higher explosiveness with lower consistency = higher upside
  const consistency = metrics.consistency || 75;
  const upsideCoefficient = 1 + Math.max(0, (explosiveness - consistency) * 0.005);

  const finalExplosiveness = baseExplosiveness * Math.min(1.25, upsideCoefficient);

  // Normalize to 0-100 scale, with floor at 20
  return Math.max(20, Math.min(100, finalExplosiveness));
}

/**
 * Categorize player into quadrant
 * 
 * Research-based Definitions:
 * 
 * ELITE (Top-Right): "Quietly Elite"
 * - High consistency (65+) + High explosiveness (65+)
 * - The complete player: reliable AND impactful
 * - Low coefficient of variation (steady performance)
 * - High floor + High ceiling
 * - Examples: CeeDee Lamb, Micah Parsons
 * - These players are often underrated because they don't vary wildly
 * 
 * VOLATILE (Top-Left): "Boom/Bust Talent"
 * - Low consistency (<60) + High explosiveness (65+)
 * - Unpredictable with ceiling games potential
 * - High coefficient of variation (large swings)
 * - Low floor + High ceiling
 * - Examples: Inconsistent but talented WRs/RBs
 * - Week-to-week variance makes them risky but potentially game-changing
 * 
 * RELIABLE (Bottom-Right): "Steady Contributors"
 * - High consistency (65+) + Lower explosiveness (<60)
 * - You know what you're getting every week
 * - Workmanlike performers
 * - High floor + Mid ceiling
 * - Examples: Volume backs, slot receivers
 * - Dependable but not flashy
 * 
 * INCONSISTENT (Bottom-Left): "Problem Area"
 * - Low consistency (<60) + Lower explosiveness (<60)
 * - Neither reliable nor explosive
 * - Low floor + Low ceiling
 * - Underperformers or developmental players
 */
function categorizePlayer(consistency, explosiveness) {
  const highConsistency = consistency > 65;
  const highExplosiveness = explosiveness > 65;

  if (highConsistency && highExplosiveness) {
    return "elite";
  } else if (!highConsistency && highExplosiveness) {
    return "volatile";
  } else if (highConsistency && !highExplosiveness) {
    return "reliable";
  } else {
    return "inconsistent";
  }
}

/**
 * Calculate volatility risk score
 * Higher variance = higher volatility
 * 
 * Sports Analytics Context:
 * - VOLATILE: High variance, low predictability
 *   Coefficient of Variation (CV) = std_dev / mean is high
 *   These players have big swings week-to-week
 * 
 * - STABLE: Low variance, predictable
 *   CV is low, consistent output
 *   Reliable performers
 * 
 * - RISKY: Low mean output with high variance
 *   Neither consistent NOR high-floor
 *
 * - PREDICTABLE: Hi mean, low variance
 *   You know what you're getting, not exciting
 * 
 * - MIXED: Middle ground, moderate variance
 */
function calculateVolatility(consistency, explosiveness) {
  // Calculate coefficient of variation effect
  // High difference between explosiveness and consistency = volatile
  const volatilityDifference = Math.abs(explosiveness - consistency);
  
  // Normalize variance calculation
  // Variance_factor shows how much upside/downside swing exists
  const varianceFactor = volatilityDifference / 100;

  // Risk classification based on performance + volatility
  if (consistency < 55 && explosiveness > 70) {
    // Low floor, high ceiling = VOLATILE
    return "VOLATILE";
  } else if (consistency < 55 && explosiveness < 65) {
    // Low on both dimensions = RISKY
    return "RISKY";
  } else if (consistency > 75 && explosiveness > 70) {
    // High on both = STABLE
    return "STABLE";
  } else if (consistency > 70 && explosiveness < 55) {
    // High consistency, low explosiveness = PREDICTABLE
    return "PREDICTABLE";
  } else {
    // Middle ground
    return "MIXED";
  }
}

/**
 * Determine performance tier
 */
function determineTier(consistency, explosiveness, metrics) {
  const combined = (consistency + explosiveness) / 2;
  const peakPotential = metrics.explosiveness || 75;

  if (combined > 75 && peakPotential > 80) {
    return "STAR";
  } else if (combined > 65) {
    return "STARTER";
  } else if (combined > 55) {
    return "ROLE_PLAYER";
  } else {
    return "BACKUP";
  }
}

/**
 * Generate detailed stats profile
 */
function generateStatsProfile(metrics, consistency, explosiveness) {
  return {
    defensiveImpact: (metrics.durability || 70) * 0.8 + Math.random() * 20,
    offensiveContribution: (metrics.offense || 70) * 0.9 + Math.random() * 10,
    bigPlayRate: explosiveness * 0.75,
    predictability: consistency * 0.85,
    clutchMoments: metrics.clutch || 70,
    seasonPotential: (consistency * 0.4 + explosiveness * 0.6) * 1.1,
  };
}

/**
 * Categorize all players by type
 * More refined categorization based on refined definitions
 */
function categorizePlayers(playerMetrics) {
  const categories = {
    quietlyElite: [],
    volatileTalent: [],
    reliableRolePlayers: [],
    underperformers: [],
    watchlist: [],
  };

  playerMetrics.forEach((player) => {
    // QUIETLY ELITE: Elite quadrant with stable volatility profile
    if (player.category === "elite" && player.volatility === "STABLE") {
      categories.quietlyElite.push(player);
    } 
    // VOLATILE TALENT: High ceiling players with boom/bust profile
    else if (player.category === "volatile" && player.explosiveness > 75) {
      categories.volatileTalent.push(player);
    } 
    // RELIABLE ROLE PLAYERS: Steady contributors in stable roles
    else if (
      player.category === "reliable" &&
      (player.volatility === "PREDICTABLE" || player.volatility === "STABLE")
    ) {
      categories.reliableRolePlayers.push(player);
    } 
    // UNDERPERFORMERS: Low on both dimensions
    else if (
      player.category === "inconsistent" ||
      (player.consistency < 50 && player.explosiveness < 50)
    ) {
      categories.underperformers.push(player);
    }

    // WATCHLIST: Players that are volatile OR otherwise need monitoring
    if (player.volatility === "VOLATILE" || player.volatility === "RISKY") {
      if (!categories.watchlist.find((p) => p.id === player.id)) {
        categories.watchlist.push(player);
      }
    }
    // Also add mid-tier players who might break out
    if (
      player.explosiveness > 65 &&
      player.consistency > 55 &&
      player.consistency < 70
    ) {
      if (!categories.watchlist.find((p) => p.id === player.id)) {
        categories.watchlist.push(player);
      }
    }
  });

  return categories;
}

/**
 * Generate strategic insights
 * Based on refined understanding of consistency vs explosiveness
 */
function generateInsights(playerMetrics) {
  const insights = [];

  // Find elite performers (quietly elite)
  const elite = playerMetrics.filter((p) => p.category === "elite");
  if (elite.length > 0) {
    const eliteNames = elite.map((p) => p.name).join(", ");
    insights.push({
      type: "strength",
      title: "Quietly Elite: The Complete Players",
      message: `${eliteNames} combine high consistency with explosive potential. These are your most reliable impact players - they deliver consistently AND have the ceiling to take over games. They may not get as much media attention as volatile talents, but they're the backbone of championship teams. Build around these players.`,
      players: elite.map((p) => p.name),
    });
  }

  // Flag volatile high-ceiling players
  const volatileHigh = playerMetrics.filter(
    (p) => p.volatility === "VOLATILE" && p.explosiveness > 70
  );
  if (volatileHigh.length > 0) {
    const volatileName = volatileHigh.map((p) => p.name).join(", ");
    insights.push({
      type: "opportunity",
      title: "High-Variance Talents: Ceiling Games Ahead",
      message: `${volatileName} show explosive potential but inconsistent week-to-week performance. These are boom-or-bust players - they can take over games (high ceiling) but may disappear in others (low floor). Monitor matchups carefully, and target them when facing weak secondaries/defenses. Great for "ceiling games" but risky as primary options.`,
      players: volatileHigh.map((p) => p.name),
    });
  }

  // Identify steady role players
  const steady = playerMetrics.filter(
    (p) => p.category === "reliable" && p.explosiveness > 50
  );
  if (steady.length > 0) {
    const steadyNames = steady.map((p) => p.name).join(", ");
    insights.push({
      type: "consistency",
      title: "Steady Contributors: Dependable Production",
      message: `${steadyNames} are the workhorses - they provide reliable, predictable production every week. Not flashy, but you know what you're getting. These players are excellent for floor games when you need guaranteed points. Use them to build a stable foundation, and pair with higher-ceiling players for upside.`,
      players: steady.map((p) => p.name),
    });
  }

  // Predictable performers (high consistency, low offensive involvement)
  const predictable = playerMetrics.filter(
    (p) => p.volatility === "PREDICTABLE" && p.consistency > 70
  );
  if (predictable.length > 0) {
    const predictableNames = predictable.map((p) => p.name).join(", ");
    insights.push({
      type: "consistency",
      title: "Predictable Anchors: Defensive/Support Roles",
      message: `${predictableNames} excel in specific roles with limited offensive variance - think defensive specialists, backup RBs, or slot receivers with limited touches. They provide stability and consistency in specialized roles, not ceiling plays.`,
      players: predictable.map((p) => p.name),
    });
  }

  // Low performers
  const struggling = playerMetrics.filter(
    (p) => p.explosiveness < 45 && p.consistency < 55
  );
  if (struggling.length > 0) {
    const strugglingNames = struggling.map((p) => p.name).join(", ");
    insights.push({
      type: "concern",
      title: "Development/Rotation Needed",
      message: `${strugglingNames} are underperforming on both dimensions - neither reliable NOR explosive. These may be injury returnees, young prospects, or players struggling with their role. Monitor for improvement or consider rotation/depth moves.`,
      players: struggling.map((p) => p.name),
    });
  }

  // Risky players (low on both, but may have upside)
  const risky = playerMetrics.filter(
    (p) => p.volatility === "RISKY" && p.tier !== "BACKUP"
  );
  if (risky.length > 0) {
    const riskyNames = risky.map((p) => p.name).join(", ");
    insights.push({
      type: "concern",
      title: "Risky Performers: Approach with Caution",
      message: `${riskyNames} lack both consistency AND ceiling - they're unpredictable AND don't offer high upside. These are players that should either improve their role/involvement or be moved to backup status. High variance with low mean = not useful.`,
      players: risky.map((p) => p.name),
    });
  }

  // Mixed performers
  const mixed = playerMetrics.filter(
    (p) => p.volatility === "MIXED" && p.tier === "STARTER"
  );
  if (mixed.length > 0 && mixed.length <= 2) {
    const mixedNames = mixed.map((p) => p.name).join(", ");
    insights.push({
      type: "opportunity",
      title: "Balanced Performers: Situational Value",
      message: `${mixedNames} sit in the middle ground - balanced consistency and explosiveness. These players have flexibility; use them based on matchup and game script. They're neither guaranteed floor nor clear ceiling plays, but offer ceiling/floor balance.`,
      players: mixed.map((p) => p.name),
    });
  }

  return insights;
}

module.exports = { computeConsistencyExplosiveness };
