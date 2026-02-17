/**
 * Maps.js - Consistency vs Explosiveness Analysis
 */

function computeConsistencyExplosiveness(players = []) {
  if (!players || players.length === 0) {
    return {
      success: false,
      error: "No player data provided",
      players: [],
      findings: {
        quietlyElite: [],
        volatileTalent: [],
        reliableRolePlayers: [],
        underperformers: [],
        watchlist: [],
      },
      insights: [],
      quadrants: {
        elite: { name: "Quietly Elite", description: "", players: [] },
        volatile: { name: "Volatile", description: "", players: [] },
        reliable: { name: "Reliable Role Players", description: "", players: [] },
        inconsistent: { name: "Inconsistent Performers", description: "", players: [] },
      },
    };
  }

  const playerMetrics = players.map((player) => {
    const metrics = player.metrics || {};

    const consistencyScore = calculateConsistency(metrics);
    const explosivenessScore = calculateExplosiveness(metrics);
    const category = categorizePlayer(consistencyScore, explosivenessScore);
    const volatility = calculateVolatility(consistencyScore, explosivenessScore);
    const tier = determineTier(consistencyScore, explosivenessScore, metrics);

    return {
      id: player.id || player.name?.replace(/\s+/g, "_").toLowerCase(),
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

  playerMetrics.sort(
    (a, b) =>
      b.explosiveness + b.consistency - (a.explosiveness + a.consistency)
  );

  const findings = categorizePlayers(playerMetrics);
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

function calculateConsistency(metrics) {
  const consistency = metrics.consistency ?? 75;
  const clutch = metrics.clutch ?? 70;
  const durability = metrics.durability ?? 70;

  const base = consistency * 0.6 + clutch * 0.25 + durability * 0.15;
  const multiplier = 1 + durability * 0.002;
  const final = base * Math.min(1.2, multiplier);

  return Math.max(20, Math.min(100, final));
}

function calculateExplosiveness(metrics) {
  const explosiveness = metrics.explosiveness ?? 75;
  const offense = metrics.offense ?? 70;
  const consistency = metrics.consistency ?? 75;

  const base = explosiveness * 0.7 + offense * 0.3;
  const upside = 1 + Math.max(0, (explosiveness - consistency) * 0.005);
  const final = base * Math.min(1.25, upside);

  return Math.max(20, Math.min(100, final));
}

function categorizePlayer(consistency, explosiveness) {
  const highConsistency = consistency > 65;
  const highExplosiveness = explosiveness > 65;

  if (highConsistency && highExplosiveness) return "elite";
  if (!highConsistency && highExplosiveness) return "volatile";
  if (highConsistency && !highExplosiveness) return "reliable";
  return "inconsistent";
}

function calculateVolatility(consistency, explosiveness) {
  if (consistency < 60 && explosiveness > 65) return "VOLATILE";
  if (consistency < 60 && explosiveness < 60) return "RISKY";
  if (consistency > 75 && explosiveness > 75) return "STABLE";
  if (consistency > 70 && explosiveness < 60) return "PREDICTABLE";
  return "MIXED";
}

function determineTier(consistency, explosiveness, metrics) {
  const combined = (consistency + explosiveness) / 2;
  const peak = metrics.explosiveness ?? 75;

  if (combined > 75 && peak > 80) return "STAR";
  if (combined > 65) return "STARTER";
  if (combined > 55) return "ROLE_PLAYER";
  return "BACKUP";
}

function generateStatsProfile(metrics, consistency, explosiveness) {
  return {
    defensiveImpact: (metrics.durability ?? 70) * 0.8,
    offensiveContribution: (metrics.offense ?? 70) * 0.9,
    bigPlayRate: explosiveness * 0.75,
    predictability: consistency * 0.85,
    clutchMoments: metrics.clutch ?? 70,
    seasonPotential: (consistency * 0.4 + explosiveness * 0.6) * 1.1,
  };
}

function categorizePlayers(players) {
  const categories = {
    quietlyElite: [],
    volatileTalent: [],
    reliableRolePlayers: [],
    underperformers: [],
    watchlist: [],
  };

  players.forEach((player) => {
    if (player.category === "elite" && player.volatility === "STABLE") {
      categories.quietlyElite.push(player);
    } else if (player.category === "volatile" && player.explosiveness > 75) {
      categories.volatileTalent.push(player);
    } else if (player.category === "reliable") {
      categories.reliableRolePlayers.push(player);
    } else {
      categories.underperformers.push(player);
    }

    if (
      (player.volatility === "VOLATILE" ||
        player.volatility === "RISKY") &&
      !categories.watchlist.some((p) => p.id === player.id)
    ) {
      categories.watchlist.push(player);
    }
  });

  return categories;
}

function generateInsights(players) {
  const insights = [];

  const elite = players.filter((p) => p.category === "elite");
  if (elite.length) {
    insights.push({
      type: "strength",
      title: "Elite Core",
      message: `${elite.map((p) => p.name).join(", ")} are elite contributors.`,
      players: elite.map((p) => p.name),
    });
  }

  const volatile = players.filter((p) => p.volatility === "VOLATILE");
  if (volatile.length) {
    insights.push({
      type: "opportunity",
      title: "Volatile Upside",
      message: `${volatile.map((p) => p.name).join(", ")} have boom potential.`,
      players: volatile.map((p) => p.name),
    });
  }

  return insights;
}

module.exports = { computeConsistencyExplosiveness };
