/**
 * CURL COMMANDS FOR TESTING COWBOYS PLAYOFF PREDICTION APP
 * 
 * Base URL (local): http://localhost:3001
 * Base URL (production): Check deployment
 * 
 * These commands test all the endpoints created for the rival team impact analyzer,
 * player maps, and related analytics features.
 */

// ============================================================================
// PLAYER MAPS ENDPOINTS
// ============================================================================

// 1. Get Consistency vs Explosiveness Map
curl -X GET http://localhost:3001/api/players/maps \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "success": true,
//   "timestamp": "2026-02-13T00:00:00.000Z",
//   "players": [
//     {
//       "id": "dak",
//       "name": "Dak Prescott",
//       "position": "QB",
//       "consistency": 78,
//       "explosiveness": 82,
//       "category": "elite",
//       "volatility": "STABLE",
//       "tier": "STAR"
//     },
//     ...
//   ],
//   "findings": { ... },
//   "quadrants": { ... }
// }


// 2. Get Player Radar (Original Endpoint)
curl -X GET http://localhost:3001/api/players/radar \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "labels": ["Offense", "Explosiveness", "Consistency", "Clutch", "Durability"],
//   "players": [...]
// }


// ============================================================================
// RIVAL IMPACT ANALYSIS ENDPOINTS
// ============================================================================

// 1. Get Rival Team Impact Analysis (Baseline)
curl -X GET "http://localhost:3001/api/analytics/rivalimpact?year=2025&chaos=0&iterations=1000" \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "success": true,
//   "timestamp": "2026-02-13T00:00:00.000Z",
//   "year": 2025,
//   "parameters": { "chaos": 0, "iterations": 1000 },
//   "cowboys": {
//     "tsi": 58,
//     "baselinePlayoffProbability": 62,
//     "components": {...}
//   },
//   "rivalImpacts": [...],
//   "rankedGames": [...],
//   "summary": "..."
// }


// 2. Get Rival Impact with Chaos Factor (High Uncertainty)
curl -X GET "http://localhost:3001/api/analytics/rivalimpact?year=2025&chaos=0.5&iterations=1000" \
  -H "Content-Type: application/json" \
  -v

// This increases variability in simulations


// 3. Get Rival Impact with More Iterations (More Accurate)
curl -X GET "http://localhost:3001/api/analytics/rivalimpact?year=2025&chaos=0&iterations=5000" \
  -H "Content-Type: application/json" \
  -v

// This runs 5000 Monte Carlo simulations (slower but more statistically sound)


// 4. High Chaos + High Iterations (Most Conservative Scenario)
curl -X GET "http://localhost:3001/api/analytics/rivalimpact?year=2025&chaos=1&iterations=5000" \
  -H "Content-Type: application/json" \
  -v


// ============================================================================
// TSI (TEAM STRENGTH INDEX) ENDPOINTS
// ============================================================================

// 1. Get Cowboys TSI
curl -X GET "http://localhost:3001/api/analytics/tsi?team=DAL&year=2025" \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "success": true,
//   "tsi": 58,
//   "components": {
//     "offense": 62,
//     "defense": 55,
//     "schedule": 52,
//     "qbAdj": 60
//   }
// }


// 2. Get Eagles TSI (Division Rival)
curl -X GET "http://localhost:3001/api/analytics/tsi?team=PHI&year=2025" \
  -H "Content-Type: application/json" \
  -v


// 3. Get 49ers TSI (Conference Threat)
curl -X GET "http://localhost:3001/api/analytics/tsi?team=SF&year=2025" \
  -H "Content-Type: application/json" \
  -v


// ============================================================================
// SEASON PATH & WIN PROBABILITY ENDPOINTS
// ============================================================================

// 1. Get Season Paths (Different playoff scenarios)
curl -X GET "http://localhost:3001/api/analytics/paths?team=DAL&year=2025&k=25&chaos=0" \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "success": true,
//   "team": "DAL",
//   "year": 2025,
//   "paths": [
//     { "wins": 11, "losses": 6, "probability": 0.15 },
//     ... (up to 25 scenarios)
//   ]
// }


// 2. Get Must-Win Games
curl -X GET "http://localhost:3001/api/analytics/mustwin?team=DAL&year=2025&chaos=0" \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "success": true,
//   "games": [...]
// }


// 3. Compute Win Probability (Live Game Scenario)
curl -X POST http://localhost:3001/api/analytics/winprob \
  -H "Content-Type: application/json" \
  -d '{
    "scoreDiff": 3,
    "secondsRemaining": 300,
    "yardLine": 45,
    "offenseTimeouts": 2,
    "defenseTimeouts": 3,
    "possession": "team",
    "down": 2,
    "yardsToGo": 8
  }' \
  -v

// Expected Response:
// {
//   "success": true,
//   "winProbability": 0.65
// }


// ============================================================================
// COWBOY-SPECIFIC ENDPOINTS
// ============================================================================

// 1. Get Cowboys Record
curl -X GET "http://localhost:3001/api/cowboys/record?year=2025" \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "wins": 10,
//   "losses": 5,
//   "ties": 0,
//   "playoffProb": 62
// }


// 2. Get Cowboys Schedule
curl -X GET "http://localhost:3001/api/cowboys/schedule?year=2025" \
  -H "Content-Type: application/json" \
  -v

// Expected Response:
// {
//   "schedule": [
//     {
//       "week": 1,
//       "opponent": "PHI",
//       "home": false,
//       "date": "2025-09-08",
//       "completed": true,
//       "result": "W"
//     },
//     ...
//   ]
// }


// ============================================================================
// BATCH TEST SCRIPT (All endpoints at once)
// ============================================================================

#!/bin/bash

BASE_URL="http://localhost:3001"
YEAR=2025

echo "=== Testing Player Maps ==="
curl -s "${BASE_URL}/api/players/maps" | jq '.' | head -50

echo ""
echo "=== Testing Rival Impact Analysis ==="
curl -s "${BASE_URL}/api/analytics/rivalimpact?year=${YEAR}&chaos=0&iterations=1000" | jq '.cowboys, .rivalImpacts[0:3]'

echo ""
echo "=== Testing Cowboys TSI ==="
curl -s "${BASE_URL}/api/analytics/tsi?team=DAL&year=${YEAR}" | jq '.'

echo ""
echo "=== Testing Eagles TSI ==="
curl -s "${BASE_URL}/api/analytics/tsi?team=PHI&year=${YEAR}" | jq '.'

echo ""
echo "=== Testing Win Probability ==="
curl -s -X POST "${BASE_URL}/api/analytics/winprob" \
  -H "Content-Type: application/json" \
  -d '{
    "scoreDiff": 3,
    "secondsRemaining": 300,
    "yardLine": 45,
    "possession": "team",
    "down": 2,
    "yardsToGo": 8
  }' | jq '.'

echo ""
echo "=== All tests complete ==="
