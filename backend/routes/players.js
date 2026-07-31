

"use strict";

const express = require("express");
const router = express.Router();
const pool = require("../databases");
const cache = require("../cache");
const espn = require("../services/espn");
const { getTimelineEvents } = require("../timeline");
const { computeClutchIndex } = require("../clutch");
const { computeConsistencyExplosiveness } = require("../Maps");


/* The roster (and the play-by-play patterns used to spot each player) now
   comes from services/roster, which derives it from Data/roster.js. It used
   to be 48 hand-written entries right here, which drifted out of date the
   moment the roster changed and silently capped these endpoints at the
   handful of players who happened to still be listed. */
const { ROSTER_MAP } = require("../services/roster");


async function fetchRealCowboysDeepStats(year) {
  const fetch = require("node-fetch");

  /* Walk back until a season with completed games turns up. Heading into a
     season nothing has been played yet, and the old single-step fallback could
     still land on another empty year — which left every player at zero snaps
     and these endpoints returning an empty roster. Three steps covers the
     preseason gap without trawling the archive. */
  let games = [];
  let completedGames = [];
  let statsYear = year;
  for (let back = 0; back <= 3; back++) {
    statsYear = year - back;
    games = await espn.fetchCowboysGamesSeasonToDate(statsYear);
    completedGames = games.filter(g => g.completed && g.id);
    if (completedGames.length > 0) break;
  }

  // 1. Initialize High-Fidelity Data Matrix
  const statsMatrix = {};
  for (const p of ROSTER_MAP) {
    statsMatrix[p.id] = {
      // Situational Metadata
      totalSnapsObserved: 0, fourthQPlays: 0, thirdDownPlays: 0, redZonePlays: 0, closeGamePlays: 0,
      fourthQSuccess: 0, thirdDownSuccess: 0, redZoneSuccess: 0, closeGameSuccess: 0,
      pressurePlays: 0, pressureSuccess: 0,
      
      // Offensive Granular
      passYards: 0, rushYards: 0, recYards: 0, 
      targets: 0, receptions: 0, carries: 0, passAttempts: 0, passCompletions: 0,
      tds: 0, intsThrown: 0, fumbles: 0, drops: 0,
      explosivePlays: 0, firstDownsGenerated: 0,

      // Defensive Granular
      soloTackles: 0, assistTackles: 0, sacks: 0, qbHits: 0, tfl: 0,
      intsCaught: 0, passDeflections: 0, forcedFumbles: 0,

      // OL & Discipline
      penalties: 0, blocks: 0, pancakes: 0,

      // Special Teams
      fgMade: 0, fgAtt: 0, punts: 0, puntYards: 0, returnYards: 0
    };
  }

  // 2. Multi-Threaded Game Log Extraction
  const summaries = await Promise.all(
    completedGames.map(async (g) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${g.id}`);
        return res.ok ? await res.json() : null;
      } catch (e) { return null; }
    })
  );

  // 3. Deep Text Analysis Loop
  for (const summary of summaries) {
    if (!summary?.drives?.previous) continue;

    const comps = summary.header?.competitions?.[0];
    const s1 = parseInt(comps?.competitors?.[0]?.score || 0);
    const s2 = parseInt(comps?.competitors?.[1]?.score || 0);
    const isCloseGame = Math.abs(s1 - s2) <= 8;

    for (const drive of summary.drives.previous) {
      if (!drive.plays) continue;
      
      for (const play of drive.plays) {
        const text = (play.text || "").toLowerCase();
        const period = play.period?.number || 1;
        const down = play.start?.down || 1;
        const distance = play.start?.distance || 10;
        const isRedZone = play.start?.yardsToEndzone <= 20;
        const yardage = play.statYardage || 0;

        const isScoring = play.scoringPlay || text.includes("touchdown");
        const isFirstDown = yardage >= distance;
        
        // Define Success Context
        const offSuccess = isFirstDown || isScoring || (down === 1 && yardage >= Math.max(4, distance / 2));
        const defSuccess = text.includes("sack") || text.includes("intercepted") || text.includes("fumble") || text.includes("incomplete") || (down === 3 && !isFirstDown) || yardage < 2;
        const isPressure = text.includes("sack") || text.includes("hurry") || text.includes("pressure") || text.includes("scramble");

        // Scan all 70 players per play
        for (const pData of ROSTER_MAP) {
          if (pData.regex.test(text)) {
            const st = statsMatrix[pData.id];
            st.totalSnapsObserved++;
            let pSuccess = false;

            // --- PENALTY CHECK ---
            if (text.includes("penalty") && !text.includes("declined")) {
              st.penalties++;
              continue; // Skip normal stat accumulation if penalty negated it
            }

            
            if (pData.side === "offense") {
              if (text.includes("pass to") || text.includes("intended for")) st.targets++;
              if (text.includes("pass") && !text.includes("incomplete") && !text.includes("intercepted")) {
                if (pData.pos === "QB") { st.passCompletions++; st.passYards += yardage; }
                else { st.receptions++; st.recYards += yardage; }
              }
              if (pData.pos === "QB" && text.includes("pass")) st.passAttempts++;
              if (text.includes("rush") || text.includes("run")) { st.carries++; st.rushYards += yardage; }
              
              if (text.includes("drop")) st.drops++;
              if (text.includes("fumble")) st.fumbles++;
              if (text.includes("intercepted") && pData.pos === "QB") st.intsThrown++;
              if (isScoring && !text.includes("intercepted")) st.tds++;
              
              if (yardage >= 15) st.explosivePlays++;
              if (isFirstDown) st.firstDownsGenerated++;

              pSuccess = offSuccess && !text.includes("fumble") && !text.includes("intercepted");
            } 
            
          
            else if (pData.side === "oline") {
              if (text.includes("block")) st.blocks++;
              pSuccess = offSuccess && !text.includes("sack"); // OL succeeds if play succeeds without giving up sack
            }

          
            else if (pData.side === "defense") {
              if (text.includes("sack")) { st.sacks++; st.explosivePlays++; st.qbHits++; }
              if (text.includes("intercepted")) { st.intsCaught++; st.explosivePlays++; }
              if (text.includes("defends") || text.includes("incomplete")) st.passDeflections++;
              if (text.includes("fumble forced")) { st.forcedFumbles++; st.explosivePlays++; }
              
              if (text.includes("tackle")) {
                if (text.includes("assist")) st.assistTackles++;
                else st.soloTackles++;
              }
              if (yardage < 0 && !text.includes("sack")) st.tfl++;

              pSuccess = defSuccess;
            } 
            
           
            else if (pData.side === "special") {
              if (text.includes("field goal")) {
                st.fgAtt++;
                if (text.includes("is good")) st.fgMade++;
              }
              if (text.includes("punt")) { st.punts++; st.puntYards += yardage; }
              if (text.includes("return")) st.returnYards += yardage;

              pSuccess = text.includes("is good") || (text.includes("punt") && yardage > 40);
            }

            // --- SITUATIONAL BUCKETS ---
            if (period >= 4) { st.fourthQPlays++; if (pSuccess) st.fourthQSuccess++; }
            if (down >= 3)   { st.thirdDownPlays++; if (pSuccess) st.thirdDownSuccess++; }
            if (isRedZone)   { st.redZonePlays++; if (pSuccess) st.redZoneSuccess++; }
            if (isCloseGame) { st.closeGamePlays++; if (pSuccess) st.closeGameSuccess++; }
            if (isPressure) {
              st.pressurePlays++;
              if (pData.side === "defense" && (text.includes("sack") || text.includes("incomplete"))) st.pressureSuccess++;
              else if (pData.side === "offense" && !text.includes("sack") && pSuccess) st.pressureSuccess++;
            }
          }
        }
      }
    }
  }

  // 4. Algorithm: Advanced Factor Normalization (0-100 scale)
  const playersData =[];
  for (const pData of ROSTER_MAP) {
    const st = statsMatrix[pData.id];
    if (st.totalSnapsObserved === 0) continue; // Skip players with 0 snaps (IR/Bench)

    let baseEff = 0.5;
    
    // Position-specific evaluation formulas
    if (pData.side === "offense") {
      const touches = st.targets + st.carries + (pData.pos === 'QB' ? st.passAttempts : 0);
      const totalYds = st.passYards + st.rushYards + st.recYards;
      baseEff = Math.min(1.0, Math.max(0, (totalYds / Math.max(1, touches)) / 10 + (st.tds / Math.max(1, touches))));
    } 
    else if (pData.side === "defense") {
      const impactScore = (st.soloTackles * 1) + (st.tfl * 2) + (st.passDeflections * 2) + (st.sacks * 4) + (st.intsCaught * 5) + (st.forcedFumbles * 4);
      baseEff = Math.min(1.0, 0.4 + (impactScore / st.totalSnapsObserved));
    } 
    else if (pData.side === "oline") {
      baseEff = Math.max(0.2, 0.8 - (st.penalties * 0.05)); // Start high, penalize for holding/false starts
    }
    else {
      baseEff = st.fgAtt > 0 ? (st.fgMade / st.fgAtt) : 0.6;
    }

    const safeDiv = (num, den) => den > 0 ? (num / den) : baseEff;

    const fourthQEff = safeDiv(st.fourthQSuccess, st.fourthQPlays);
    const thirdDownEff = safeDiv(st.thirdDownSuccess, st.thirdDownPlays);
    const redZoneEff = safeDiv(st.redZoneSuccess, st.redZonePlays);
    const closeGameEff = safeDiv(st.closeGameSuccess, st.closeGamePlays);
    const pressureEff = safeDiv(st.pressureSuccess, Math.max(1, st.pressurePlays));

    playersData.push({
      id: pData.id,
      name: pData.name,
      position: pData.pos,
      role: pData.role,
      
      // Radar/Map High-Level Metrics
      metrics: {
        consistency: Math.max(20, Math.min(99, Math.round(baseEff * 100))),
        clutch: Math.max(20, Math.min(99, Math.round(fourthQEff * 100))),
        explosiveness: Math.max(20, Math.min(99, Math.round(30 + (st.explosivePlays * 4)))),
        durability: Math.max(40, Math.min(99, 40 + (st.totalSnapsObserved / 4))),
        offense: pData.side === "defense" ? 20 : Math.max(30, Math.min(99, Math.round(40 + (st.tds * 5) + ((st.passYards + st.rushYards + st.recYards) / 50))))
      },
      
      // Situational Matrix for Clutch Algorithm
      stats: {
        fourthQStats: { efficiency: fourthQEff },
        regularStats: { efficiency: baseEff },
        thirdDownStats: { success: st.thirdDownSuccess, attempts: Math.max(1, st.thirdDownPlays) },
        fourthDownStats: { success: 0, attempts: 1 }, 
        redZoneStats: { touchdowns: st.redZoneSuccess, attempts: Math.max(1, st.redZonePlays) },
        closeGameStats: { wins: st.closeGameSuccess, closeGames: Math.max(1, st.closeGamePlays) },
        twoMinStats: { heroMoments: st.tds + st.sacks + st.intsCaught },
        gameWinningStats: { gwSuccesses: st.fourthQSuccess, gwAttempts: Math.max(1, st.fourthQPlays) },
        pressureStats: { successUnderPressure: st.pressureSuccess, pressurePlays: Math.max(1, st.pressurePlays) }
      },
      
      // Complete Deep Data Dictionary (Exposed for UI expansion)
      rawStats: st
    });
  }

  return playersData;
}



function normalizeSeason(value, fallback = new Date().getFullYear()) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 3000 ? year : fallback;
}

function normalizeLimit(value, fallback = 50, max = 500) {
  const parsed = Number.parseInt(value, 10);
  return (!Number.isFinite(parsed) || parsed <= 0) ? fallback : Math.min(parsed, max);
}

function asString(value) { return value === undefined || value === null ? "" : String(value).trim(); }
function normalizeQuery(value) { return asString(value).toLowerCase(); }
function safeArray(value) { return Array.isArray(value) ? value : []; }

router.get("/maps", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const result = await cache.getOrCompute(`MAPS_FINAL_${season}`, async () => {
      const playersData = await fetchRealCowboysDeepStats(season);
      return computeConsistencyExplosiveness(playersData);
    }, { ttl: 3600 }); 

    res.json(result);
  } catch (error) {
    console.error("Maps matrix error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/radar", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const result = await cache.getOrCompute(`RADAR_FINAL_${season}`, async () => {
      const playersData = await fetchRealCowboysDeepStats(season);
      const topPerformers = playersData
        .sort((a,b) => (b.metrics.offense + b.metrics.explosiveness + b.metrics.consistency) - (a.metrics.offense + a.metrics.explosiveness + a.metrics.consistency))
        .slice(0, 10);
      return {
        labels: ["Offense", "Explosiveness", "Consistency", "Clutch", "Durability"],
        players: topPerformers
      };
    }, { ttl: 3600 });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/clutch", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const result = await cache.getOrCompute(`CLUTCH_FINAL_${season}`, async () => {
      const playersData = await fetchRealCowboysDeepStats(season);
      return computeClutchIndex(playersData, { season });
    }, { ttl: 3600 }); 

    res.json(result);
  } catch (error) {
    console.error("Clutch matrix error:", error);
    res.status(500).json({ error: "Failed to compute clutch matrix. " + error.message });
  }
});

// GET /api/players/search - Search against the full 70-man mapping
router.get("/search", async (req, res) => {
  try {
    const query = asString(req.query.name || req.query.q);
    const limit = normalizeLimit(req.query.limit, 20, 50);
    if (!query) return res.json([]);

    let results =[];
    try {
      const dbResult = await pool.query(
        `SELECT DISTINCT CAST(player_id AS TEXT) AS player_id, player_name FROM player_events WHERE player_name ILIKE $1 LIMIT 20`, [`%${query}%`]
      );
      results = safeArray(dbResult.rows).map((row) => ({
        player_id: row.player_id || normalizeQuery(row.player_name).replace(/\s+/g, "_"),
        player_name: row.player_name,
        team: "DAL"
      })).slice(0, limit);
    } catch (err) {}

    // Fallback to static enterprise mapping if DB is empty
    if (!results.length) {
      const norm = normalizeQuery(query);
      results = ROSTER_MAP.filter(p => 
        normalizeQuery(p.name).includes(norm) || p.id.includes(norm)
      ).map(p => ({ player_id: p.id, player_name: p.name, position: p.pos, team: "DAL" })).slice(0, limit);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// POST /api/players/events
router.post("/events", async (req, res) => {
  try {
    const { player_id, player_name, event_type, event_date, description, impact_score, season } = req.body || {};
    if (!player_name || !event_type || !event_date) return res.status(400).json({ error: "Missing fields" });

    const normalizedSeason = normalizeSeason(season, new Date(event_date).getFullYear());

    const result = await pool.query(
      `INSERT INTO player_events (player_id, player_name, event_type, event_date, description, impact_score, season)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (player_name, event_date, event_type)
       DO UPDATE SET description = EXCLUDED.description, impact_score = EXCLUDED.impact_score, updated_at = NOW()
       RETURNING *`,[player_id || null, player_name, event_type, event_date, description || null, impact_score ?? null, normalizedSeason]
    );

    await cache.clearNamespace("PLAYER_EVENTS");
    await cache.clearNamespace("TIMELINE_POINTS");
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/players/events
router.get("/events", async (req, res) => {
  try {
    const season = normalizeSeason(req.query.season);
    const limit = normalizeLimit(req.query.limit, 50, 500);

    const timelineData = await getTimelineEvents({ season });
    const events = safeArray(timelineData.events).slice(0, limit).map(e => ({
      id: e.id, player_name: e.playerName, event_type: e.eventType, event_date: e.date, impact_score: e.impact
    }));

    res.json({ events, season, count: events.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

module.exports = router;
