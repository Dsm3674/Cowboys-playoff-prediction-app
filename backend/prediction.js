

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));


function getNFLSeasonYear() {
  const now = new Date();
  const month = now.getMonth(); // Jan = 0
  return month < 2 ? now.getFullYear() - 1 : now.getFullYear();
}


async function fetchCowboysStats() {
  try {
    const year = getNFLSeasonYear();

    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/2/teams/6/statistics`;

    console.log(`📡 Fetching ESPN Cowboys stats for ${year}`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ESPN request failed: ${res.status}`);
    }

    const data = await res.json();

    let pointsFor = 0;
    let pointsAgainst = 0;
    let yardsPerGame = 0;
    let turnovers = 1.5; // default fallback

    // ESPN changes stat keys often — be defensive
    for (const category of data.splits?.categories || []) {
      for (const stat of category.stats || []) {
        const key = (stat.name || "").toLowerCase();

        if (
          key.includes("pointspergame") ||
          key.includes("points_for") ||
          key === "ppg"
        ) {
          pointsFor = Number(stat.value);
        }

        if (
          key.includes("pointsallowedpergame") ||
          key.includes("points_against") ||
          key === "papg"
        ) {
          pointsAgainst = Number(stat.value);
        }

        if (key.includes("yardspergame")) {
          yardsPerGame = Number(stat.value);
        }

        if (key === "turnovers") {
          turnovers = Number(stat.value);
        }
      }
    }

    // Fallback if ESPN returns zeros or missing fields
    if (!pointsFor && !pointsAgainst) {
      console.warn("⚠️ ESPN returned missing stats — using defaults");
      pointsFor = 27.1;
      pointsAgainst = 18.6;
    }

    const result = {
      avg_points_scored: pointsFor,
      avg_points_allowed: pointsAgainst,
      avg_total_yards: yardsPerGame,
      avg_turnovers: turnovers,
      year,
    };

    console.log("✅ Normalized Cowboys stats:", result);
    return result;

  } catch (err) {
    console.error("❌ Error fetching Cowboys stats:", err.message);

    // Always return safe defaults
    return {
      avg_points_scored: 0,
      avg_points_allowed: 0,
      avg_total_yards: 0,
      avg_turnovers: 0,
      year: getNFLSeasonYear(),
    };
  }
}


function generatePrediction(stats) {
  const { avg_points_scored, avg_points_allowed } = stats;

  // Normalize offense / defense
  const offenseFactor = avg_points_scored / 30;
  const defenseFactor = 25 / (avg_points_allowed + 1);

  const base = (offenseFactor + defenseFactor) / 2;

  const playoffChance = Math.min(1, base);
  const divisionChance = playoffChance * 0.8;
  const conferenceChance = playoffChance * 0.5;
  const superBowlChance = playoffChance * 0.25;

  return {
    playoffs: Number(playoffChance.toFixed(3)),
    division: Number(divisionChance.toFixed(3)),
    conference: Number(conferenceChance.toFixed(3)),
    superBowl: Number(superBowlChance.toFixed(3)),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchCowboysStats,
  generatePrediction,
};

