// /backend/winprob.js
/**
 * In-game win probability for "our" team (Dallas in the UI).
 *
 * Stern (1994), "A Brownian Motion Model for the Progress of Sports Scores":
 * the final margin from any point is roughly normal, with a mean of the
 * current lead plus the expected edge over the time left, and a standard
 * deviation that shrinks with the square root of the time left. For the NFL,
 * Stern estimated a full-game standard deviation of about 13.45 points.
 *
 *   P(win) = Φ( (lead + EP + μ·f) / (σ·√f) ),  f = fraction of the game left
 *
 * The lead is adjusted by the expected points of the current possession
 * (field position, down and distance), credited to whoever has the ball. At
 * 0:00 only the scoreboard matters. Late in the game the model is somewhat
 * overconfident, because real scoring comes in 3s and 7s and onside kicks
 * happen, so results are kept within 1%-99%.
 */

const FULL_GAME_SD = 13.45;
const GAME_SECONDS = 3600;

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/* Standard normal CDF (Abramowitz & Stegun 7.1.26). */
function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
    Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/* Expected points for the team with the ball, by yards from its own goal
   line, read off the published nflscrapR / nflfastR first-down EP curve. */
const EP_CURVE = [
  [1, -0.7], [10, -0.3], [25, 0.6], [50, 2.0], [75, 3.8], [90, 4.7], [99, 6.0],
];

function expectedPoints(yardsFromOwnGoal, down, yardsToGo) {
  const y = clamp(yardsFromOwnGoal, 1, 99);
  let ep = EP_CURVE[EP_CURVE.length - 1][1];
  for (let i = 1; i < EP_CURVE.length; i++) {
    const [x1, e1] = EP_CURVE[i];
    const [x0, e0] = EP_CURVE[i - 1];
    if (y <= x1) {
      ep = e0 + ((y - x0) / (x1 - x0)) * (e1 - e0);
      break;
    }
  }
  // Later downs and longer distances lower the value of the possession.
  const downCost = [0, 0.3, 0.8, 1.5][down - 1];
  return ep - downCost * clamp(yardsToGo / 10, 0.5, 2);
}

/**
 * Inputs (all from our team's side):
 * {
 *   scoreDiff: number,          our score minus theirs
 *   secondsRemaining: number,   0-3600 of regulation
 *   yardLine: number,           yards from the possessing team's own goal (0-100)
 *   offenseTimeouts: number,    our timeouts (legacy name)
 *   defenseTimeouts: number,    their timeouts (legacy name)
 *   possession: "team" | "opp" | "opponent",
 *   down: 1..4,
 *   yardsToGo: number,
 *   pregameSpread: number       optional: our expected full-game margin (+ = favored)
 * }
 */
function computeWinProbability(s) {
  if (s == null || typeof s !== "object") throw new Error("payload required");

  const scoreDiff = Number(s.scoreDiff ?? 0);
  const secondsRemaining = clamp(Number(s.secondsRemaining ?? GAME_SECONDS), 0, GAME_SECONDS);
  const yardLine = clamp(Number(s.yardLine ?? 25), 0, 100);
  const ourTimeouts = clamp(Number(s.offenseTimeouts ?? 3), 0, 3);
  const theirTimeouts = clamp(Number(s.defenseTimeouts ?? 3), 0, 3);
  const possession = String(s.possession || "team").toLowerCase();
  const weHaveBall = !(possession === "opp" || possession === "opponent");
  const down = clamp(Math.round(Number(s.down ?? 1)), 1, 4);
  const yardsToGo = clamp(Number(s.yardsToGo ?? 10), 1, 30);
  const pregameSpread = Number(s.pregameSpread ?? 0) || 0;

  if (![scoreDiff, secondsRemaining, yardLine].every(Number.isFinite)) {
    throw new Error("scoreDiff, secondsRemaining and yardLine must be numbers");
  }

  const f = secondsRemaining / GAME_SECONDS;
  if (f === 0) {
    const p = scoreDiff > 0 ? 1 : scoreDiff < 0 ? 0 : 0.5;
    return Number(clamp(p, 0.01, 0.99).toFixed(4));
  }

  const ep = expectedPoints(yardLine, down, yardsToGo);
  // Timeouts matter only when the clock is short (last five minutes).
  const timeoutEdge = secondsRemaining <= 300 ? (ourTimeouts - theirTimeouts) * 0.4 : 0;
  const lead = scoreDiff + (weHaveBall ? ep : -ep) + timeoutEdge + pregameSpread * f;
  const p = normalCdf(lead / (FULL_GAME_SD * Math.sqrt(f)));
  return Number(clamp(p, 0.01, 0.99).toFixed(4));
}

module.exports = { computeWinProbability, _internals: { normalCdf, expectedPoints } };
