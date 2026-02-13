// /backend/rivalAnalysis.js
const { computeTSI } = require("./tsi");

/**
 * Computes the impact of rival team outcomes on Cowboys' playoff chances
 * @param {Object} options - Configuration options
 * @param {number} options.year - NFL season year
 * @param {number} options.chaos - Chaos factor (0-1)
 * @param {number} options.iterations - Number of Monte Carlo iterations
 * @returns {Object} Impact analysis results
 */
async function computeRivalImpact(options = {}) {
  const { year, chaos = 0, iterations = 1000 } = options;

  // Key AFC/NFC rivals and teams in Cowboys' playoff picture
  const rivalTeams = [
    { code: "PHI", tier: "direct_rival", name: "Eagles" },
    { code: "WAS", tier: "direct_rival", name: "Commanders" },
    { code: "NYG", tier: "direct_rival", name: "Giants" },
    { code: "SF", tier: "threat", name: "49ers" },
    { code: "TB", tier: "threat", name: "Buccaneers" },
    { code: "NO", tier: "threat", name: "Saints" },
    { code: "ATL", tier: "threat", name: "Falcons" },
    { code: "LAR", tier: "threat", name: "Rams" },
    { code: "SEA", tier: "threat", name: "Seahawks" },
    { code: "KC", tier: "threat", name: "Chiefs" },
    { code: "BUF", tier: "threat", name: "Bills" },
    { code: "MIA", tier: "threat", name: "Dolphins" },
    { code: "BAL", tier: "threat", name: "Ravens" },
  ];

  try {
    // Fetch TSI for Cowboys
    const cowboysTSI = await computeTSI({
      teamAbbr: "DAL",
      year,
    });

    // Calculate Cowboys baseline playoff probability
    const baselineProbability = Math.min(
      95,
      Math.max(10, (cowboysTSI.tsi / 100) * 90 + 15)
    );

    // Fetch TSI for all rival teams in parallel
    const rivalDataPromises = rivalTeams.map(async (rival) => {
      try {
        const tsiData = await computeTSI({
          teamAbbr: rival.code,
          year,
        });
        return { ...rival, tsi: tsiData.tsi, components: tsiData.components };
      } catch (error) {
        console.error(`Failed to get TSI for ${rival.code}:`, error);
        return { ...rival, tsi: 50, components: {} };
      }
    });

    const rivalTSIData = await Promise.all(rivalDataPromises);

    // Analyze impact of each rival
    const impactAnalysis = rivalTSIData
      .map((rival) => {
        const impactMetrics = calculateImpactMetrics(
          rival,
          cowboysTSI.tsi,
          baselineProbability,
          chaos,
          iterations
        );
        return {
          team: rival.code,
          teamName: rival.name,
          tier: rival.tier,
          tsi: rival.tsi,
          components: rival.components,
          ...impactMetrics,
        };
      })
      .sort((a, b) => b.impactScore - a.impactScore);

    // Rank games by impact potential
    const rankedGames = rankGamesByImpact(impactAnalysis);

    return {
      success: true,
      timestamp: new Date(),
      year,
      parameters: {
        chaos,
        iterations,
      },
      cowboys: {
        tsi: cowboysTSI.tsi,
        baselinePlayoffProbability: baselineProbability,
        components: cowboysTSI.components,
      },
      rivalImpacts: impactAnalysis,
      rankedGames,
      summary: generateSummary(impactAnalysis, baselineProbability),
    };
  } catch (error) {
    console.error("Error computing rival impact:", error);
    throw new Error(`Failed to compute rival impact: ${error.message}`);
  }
}

/**
 * Calculates impact metrics for a rival team
 */
function calculateImpactMetrics(rival, cowboysTSI, baselineProb, chaos, iterations) {
  // Base impact score by tier
  let baseImpact = 0;
  if (rival.tier === "direct_rival") {
    baseImpact = 95;
  } else if (rival.tier === "threat") {
    baseImpact = 75;
  } else {
    baseImpact = 45;
  }

  // Adjust based on rival's strength
  const rivalStrengthFactor = rival.tsi / 100;
  const impactScore = Math.round(baseImpact * (0.7 + 0.3 * rivalStrengthFactor));

  // Calculate expected playoff impact
  const playoffImpactPercentage = calculatePlayoffImpact(
    rival.tier,
    rival.tsi,
    cowboysTSI,
    chaos,
    iterations
  );

  // Urgency level
  const urgency =
    impactScore > 80 ? "critical" : impactScore > 50 ? "high" : "medium";

  // Win probability for the rival
  let winProbability = rival.tsi / 100;
  if (chaos > 0) {
    // Apply chaos factor
    winProbability =
      winProbability +
      (Math.random() - 0.5) * chaos * 0.2;
    winProbability = Math.max(0.2, Math.min(0.8, winProbability));
  }

  // Recommended outcome from Cowboys perspective
  const recommendedOutcome =
    rival.tier === "direct_rival" || rival.tier === "threat" ? "Loss" : "Loss";

  // Run Monte Carlo simulation to estimate impact variance
  const simulationResults = runMonteCarloSimulation(
    rival,
    baselineProb,
    iterations,
    chaos
  );

  return {
    impactScore,
    urgency,
    winProbability: Math.round(winProbability * 100),
    recommendedOutcome,
    playoffImpactPercentage: Math.round(playoffImpactPercentage * 100) / 100,
    bestCaseScenario: Math.round(simulationResults.bestCase),
    worstCaseScenario: Math.round(simulationResults.worstCase),
    expectedImpact: Math.round(simulationResults.expectedValue),
    simulation: simulationResults,
  };
}

/**
 * Calculate playoff impact percentage based on team tier and strength
 */
function calculatePlayoffImpact(tier, rivalTSI, cowboysTSI, chaos, iterations) {
  let baseImpact = 0;

  if (tier === "direct_rival") {
    // Division rivals heavily impact seeding
    baseImpact = 3.5;
  } else if (tier === "threat") {
    // Threats affect both seeding and wildcard probability
    baseImpact = 2.0;
  } else {
    baseImpact = 0.5;
  }

  // Normalize by strength differential
  const strengthDiff = Math.abs(rivalTSI - cowboysTSI) / 100;
  let impactAdjustment = 1 + strengthDiff * 0.5;

  if (chaos > 0) {
    impactAdjustment *=
      1 + (Math.random() - 0.5) * chaos;
  }

  return baseImpact * impactAdjustment;
}

/**
 * Run Monte Carlo simulation to estimate impact distribution
 */
function runMonteCarloSimulation(rival, baseline, iterations, chaos) {
  const results = [];

  for (let i = 0; i < Math.min(iterations, 1000); i++) {
    // Simulate rival win probability with chaos
    let winProb = rival.tsi / 100;
    if (chaos > 0) {
      winProb +=
        (Math.random() - 0.5) * chaos * 0.3;
      winProb = Math.max(0.1, Math.min(0.9, winProb));
    }

    // Simulate outcome
    const rivalWins = Math.random() < winProb;

    // Estimate impact on Cowboys
    let impactOnCowboys = 0;
    if (rival.tier === "direct_rival") {
      impactOnCowboys = rivalWins ? -2.5 : 1.5;
    } else if (rival.tier === "threat") {
      impactOnCowboys = rivalWins ? -1.5 : 0.8;
    } else {
      impactOnCowboys = rivalWins ? -0.3 : 0.2;
    }

    const projectedCowboysProb = baseline + impactOnCowboys;
    results.push({
      scenario: rivalWins ? "win" : "loss",
      cowboysProb: Math.max(5, Math.min(95, projectedCowboysProb)),
      impact: impactOnCowboys,
    });
  }

  const cowboysProbsIfRivalWins = results
    .filter((r) => r.scenario === "win")
    .map((r) => r.cowboysProb);
  const cowboysProbsIfRivalLoses = results
    .filter((r) => r.scenario === "loss")
    .map((r) => r.cowboysProb);

  const avg = (arr) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : baseline;
  const max = (arr) => (arr.length > 0 ? Math.max(...arr) : baseline);
  const min = (arr) => (arr.length > 0 ? Math.min(...arr) : baseline);

  return {
    bestCase: max([...cowboysProbsIfRivalLoses, ...cowboysProbsIfRivalWins]),
    worstCase: min([...cowboysProbsIfRivalLoses, ...cowboysProbsIfRivalWins]),
    expectedValue: avg([...cowboysProbsIfRivalLoses, ...cowboysProbsIfRivalWins]),
    ifRivalWins: {
      average: avg(cowboysProbsIfRivalWins),
      min: min(cowboysProbsIfRivalWins),
      max: max(cowboysProbsIfRivalWins),
    },
    ifRivalLoses: {
      average: avg(cowboysProbsIfRivalLoses),
      min: min(cowboysProbsIfRivalLoses),
      max: max(cowboysProbsIfRivalLoses),
    },
  };
}

/**
 * Rank games by impact potential
 */
function rankGamesByImpact(impactAnalysis) {
  return impactAnalysis
    .map((impact, idx) => ({
      rank: idx + 1,
      ...impact,
    }))
    .slice(0, 15);
}

/**
 * Generate summary of rival impact analysis
 */
function generateSummary(impacts, baselineProb) {
  const critical = impacts.filter((i) => i.urgency === "critical");
  const highUrgency = impacts.filter((i) => i.urgency === "high");

  let summary = `Cowboys' baseline playoff probability is ${baselineProb}%. `;

  if (critical.length > 0) {
    const criticalTeams = critical
      .map((i) => i.teamName)
      .slice(0, 3)
      .join(", ");
    summary += `${criticalTeams} have CRITICAL impact on playoff odds. `;
  }

  if (highUrgency.length > 0) {
    const highTeams = highUrgency
      .map((i) => i.teamName)
      .slice(0, 3)
      .join(", ");
    summary += `${highTeams} games should be monitored closely.`;
  }

  return summary;
}

module.exports = { computeRivalImpact };
