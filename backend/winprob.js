// /backend/winprob.js
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}
function logistic(z) {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Inputs (suggested payload):
 * {
 *   scoreDiff: number,          
 *   secondsRemaining: number,    
 *   yardLine: number,         
 *   offenseTimeouts: number,   
 *   defenseTimeouts: number,  
 *   possession: "team"|"opp", 
 *   down: 1..4,                 
 *   yardsToGo: number          
 * }
 */
function computeWinProbability(s) {
  if (s == null || typeof s !== "object") throw new Error("payload required");

  const scoreDiff = Number(s.scoreDiff ?? 0);
  const secondsRemaining = clamp(Number(s.secondsRemaining ?? 3600), 0, 3600);
  const yardLine = clamp(Number(s.yardLine ?? 50), 0, 100);
  const offenseTimeouts = clamp(Number(s.offenseTimeouts ?? 3), 0, 3);
  const defenseTimeouts = clamp(Number(s.defenseTimeouts ?? 3), 0, 3);

  const possession = (s.possession || "team").toLowerCase(); // "team" or "opp"
  const down = clamp(Number(s.down ?? 1), 1, 4);
  const yardsToGo = clamp(Number(s.yardsToGo ?? 10), 1, 30);

  // Normalize core features
  const timeFrac = secondsRemaining / 3600;     
  const fieldAdv = (yardLine - 50) / 50;       
  const timeoutAdv = (offenseTimeouts - defenseTimeouts) / 3; 
  const poss = possession === "opp" ? -1 : 1;

  // Down-distance pressure (optional but helps)
  const downStress = (down - 1) / 3;          
  const distStress = (yardsToGo - 10) / 20;    

 
  const late = 1 - timeFrac;

  let z =
    0.95 * scoreDiff +                
    (1.25 * late) * scoreDiff +       
    0.9 * fieldAdv +
    0.6 * timeoutAdv +
    0.55 * poss +
    (-0.45 * downStress) +
    (-0.35 * distStress) +
    (0.4 * late) * fieldAdv +
    (0.35 * late) * poss;

  // Scale down z because scoreDiff is in points
  z = z / 7.5;

  const p = logistic(z);
  return Number(clamp(p, 0.01, 0.99).toFixed(4));
}

module.exports = { computeWinProbability };
