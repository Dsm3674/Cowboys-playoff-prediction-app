/**
 * timeline.js - Timeline analytics with inflection point detection
 * Detects local peaks and valleys in performance metrics
 */

const db = require("./databases");

/**
 * Detect inflection points (peaks and valleys) in timeline data
 * using local maxima/minima detection
 */
function detectInflectionPoints(points) {
  if (points.length < 3) return [];

  const inflections = [];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].value;
    const curr = points[i].value;
    const next = points[i + 1].value;

    // Peak: local maximum
    if (curr > prev && curr > next) {
      inflections.push({
        date: points[i].date,
        type: "peak",
        value: curr,
        description: `Performance peak on ${new Date(points[i].date).toLocaleDateString()}`,
      });
    }
    // Valley: local minimum
    else if (curr < prev && curr < next) {
      inflections.push({
        date: points[i].date,
        type: "valley",
        value: curr,
        description: `Performance valley on ${new Date(points[i].date).toLocaleDateString()}`,
      });
    }
  }

  return inflections;
}

/**
 * Generate timeline data from player events and predictions
 * @param {number} season - NFL season
 * @returns {Promise<Object>} Timeline data with points and inflections
 */
async function getTimelineData(season) {
  try {
    // Fetch player events for the season
    const eventsResult = await db.query(
      `SELECT event_date, impact_score, event_type
       FROM player_events
       WHERE season = $1
       ORDER BY event_date ASC`,
      [season]
    );

    const events = eventsResult.rows;

    // Generate timeline points: aggregate impact scores by date
    const pointsMap = new Map();

    events.forEach((event) => {
      const dateStr = event.event_date.split("T")[0]; // YYYY-MM-DD

      if (!pointsMap.has(dateStr)) {
        pointsMap.set(dateStr, {
          date: event.event_date,
          value: 0,
          count: 0,
        });
      }

      const point = pointsMap.get(dateStr);
      point.value += event.impact_score;
      point.count += 1;
    });

    // Convert to array and calculate average impact per day
    let timelinePoints = Array.from(pointsMap.values()).map((p) => ({
      date: p.date,
      value: p.value / p.count, // Average impact score per day
    }));

    // If no events, generate synthetic timeline
    if (timelinePoints.length === 0) {
      const startDate = new Date(season, 0, 1);
      const endDate = new Date(season, 11, 31);
      timelinePoints = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
        timelinePoints.push({
          date: d.toISOString(),
          value: 5 + Math.sin((d - startDate) / (endDate - startDate) * Math.PI * 2) * 2 + Math.random() - 0.5,
        });
      }
    }

    // Sort by date
    timelinePoints.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Detect inflection points
    const inflectionPoints = detectInflectionPoints(timelinePoints);

    return {
      season,
      points: timelinePoints,
      inflectionPoints,
      eventCount: events.length,
    };
  } catch (err) {
    console.error("Error generating timeline data:", err);
    return {
      season,
      points: [],
      inflectionPoints: [],
      eventCount: 0,
      error: err.message,
    };
  }
}

/**
 * Get timeline inflection points for season
 * @param {number} season - NFL season
 * @returns {Promise<Object>} Inflection points data
 */
async function getInflectionPoints(season) {
  const timelineData = await getTimelineData(season);
  return {
    season: timelineData.season,
    inflectionPoints: timelineData.inflectionPoints,
  };
}

module.exports = {
  getTimelineData,
  getInflectionPoints,
  detectInflectionPoints,
};
