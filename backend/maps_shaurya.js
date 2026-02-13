const pool = require("./databases");
const Team = require("./teams");
const Season = require("./seasons");

function mean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s, v) => s + Number(v || 0), 0) / arr.length;
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + Math.pow(Number(x || 0) - m, 2), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function percentile(arr = [], p) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function zscore(val, arr) {
  const m = mean(arr || []);
  const s = stddev(arr || []);
  if (s === 0) return 0;
  return (val - m) / s;
}

/**
 * Compute consistency vs explosiveness map for Cowboys players.
 * - Consistency: higher when player performance_rating is high and volatility low
 * - Explosiveness: use mean impact_index from player_projections (or performance_rating fallback)
 * - Volatility: stddev of impact_index
 */
async function computePlayerMaps({ year } = {}) {
  // Find Cowboys team and season
  const cowboys = await Team.findByName("Dallas Cowboys");
  if (!cowboys) throw new Error("Cowboys team not found in DB");

  const currentSeason = await Season.getCurrentSeason(cowboys.team_id);
  if (!currentSeason) throw new Error("No current season data for Cowboys");

  // If caller passed year, try to fetch that season instead
  let seasonId = currentSeason.season_id;
  if (year && Number(year) !== Number(currentSeason.year)) {
    const q = "SELECT * FROM seasons WHERE team_id=$1 AND year=$2 LIMIT 1";
    const r = await pool.query(q, [cowboys.team_id, Number(year)]);
    if (r.rows[0]) seasonId = r.rows[0].season_id;
  }

  // Fetch players for the season
  const playersRes = await pool.query(
    "SELECT player_id, player_name, position, performance_rating, games_played FROM players WHERE season_id = $1",
    [seasonId]
  );

  const players = [];

  // gather impact stats for population-level thresholds
  const allExpl = [];
  const allCons = [];
  const allVol = [];

  const rawRows = [];
  for (const p of playersRes.rows) {
    // fetch projections for this player
    const projRes = await pool.query(
      "SELECT impact_index, week FROM player_projections WHERE player_id = $1 ORDER BY week ASC",
      [p.player_id]
    );
    const impacts = projRes.rows.map((r) => Number(r.impact_index || 0));

    const explosiveness = impacts.length ? mean(impacts) : Number(p.performance_rating || 0);
    const volatility = impacts.length ? stddev(impacts) : 0;

    // consistency: scaled 0-100 value, higher is better when performance_rating high and volatility low
    const perf = Number(p.performance_rating || explosiveness || 70);
    // simple heuristic: consistency = perf - (volatility * 1.5)
    let consistency = perf - volatility * 1.5;
    consistency = Math.max(30, Math.min(99, Math.round(consistency * 10) / 10));

    // explosiveness scale 0-100, normalize to similar range
    let expl = Math.max(30, Math.min(99, Math.round(explosiveness * 10) / 10));
    rawRows.push({
      id: p.player_id,
      name: p.player_name,
      position: p.position,
      performance_rating: perf,
      explosiveness: expl,
      consistency,
      volatility: Number(volatility.toFixed(2)),
      games_played: p.games_played || 0,
      _rawExpl: explosiveness,
      _rawVol: volatility,
    });

    allExpl.push(expl);
    allCons.push(consistency);
    allVol.push(Number(volatility || 0));
  }

  // compute distribution thresholds
  const expl80 = percentile(allExpl, 0.8);
  const cons80 = percentile(allCons, 0.8);
  const volMean = mean(allVol);

  for (const r of rawRows) {
    // volatility z-score
    const volZ = zscore(r._rawVol, allVol);
    // coefficient of variation (volatility relative to explosiveness)
    const cov = r._rawExpl ? r._rawVol / r._rawExpl : 0;

    // tuned definitions (research-informed heuristics):
    // - Volatile: high absolute volatility (above population mean by ~0.75 std) OR cov > 0.25
    // - Quietly elite: explosiveness in top 20% AND consistency in top 20% AND volatility below population mean
    const volatile = volZ > 0.75 || cov > 0.25;
    const quietlyElite = r.explosiveness >= expl80 && r.consistency >= cons80 && r._rawVol <= volMean;

    players.push({
      id: r.id,
      name: r.name,
      position: r.position,
      performance_rating: r.performance_rating,
      explosiveness: r.explosiveness,
      consistency: r.consistency,
      volatility: Number(r.volatility.toFixed(2)),
      volatile,
      quietlyElite,
      games_played: r.games_played,
      diagnostics: { volZ: Number(volZ.toFixed(2)), cov: Number(cov.toFixed(2)), expl80: Number(expl80.toFixed(1)), cons80: Number(cons80.toFixed(1)), volMean: Number(volMean.toFixed(2)) },
    });
  }

  // Sort for convenience
  players.sort((a, b) => b.explosiveness - a.explosiveness);

  return { seasonId, seasonYear: year || currentSeason.year, players };
}

module.exports = { computePlayerMaps, mean, stddev, percentile, zscore };
