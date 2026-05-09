/* ----------------------------------------------------------------------
   COWBOYS IQ - LANDING SCRIPT

   Backend contract:
     GET  /api/predictions/current    -> latest cached prediction, if present
     POST /api/predictions/generate   -> fresh prediction, if present
     GET  /health                     -> up/down

   The deployed backend currently uses the singular /api/prediction prefix,
   so this script tries both plural and singular endpoint variants.
------------------------------------------------------------------------ */

const APP_URL = "https://cowboys-playoff-prediction-app-production.up.railway.app";
const API_URL = `${APP_URL}/api`;

document.addEventListener("DOMContentLoaded", () => {
  setupFanConfidence();
  setupSmoothScroll();
  initializeLandingPrediction();
});

async function initializeLandingPrediction() {
  showMockData();

  const currentEndpoints = ["/predictions/current", "/prediction/current"];
  const generateEndpoints = ["/predictions/generate", "/prediction/generate"];

  for (const endpoint of currentEndpoints) {
    try {
      const data = await fetchJSON(`${API_URL}${endpoint}`);
      const pred = extractPrediction(data);
      if (pred) {
        updatePredictionDisplay(pred);
        return;
      }
    } catch (err) {
      logApiError(endpoint, err);
    }
  }

  for (const endpoint of generateEndpoints) {
    try {
      const data = await fetchJSON(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const pred = extractPrediction(data);
      if (pred) {
        updatePredictionDisplay(pred);
        return;
      }
    } catch (err) {
      logApiError(endpoint, err);
    }
  }
}

function extractPrediction(payload) {
  if (!payload) return null;
  if (payload.prediction && typeof payload.prediction === "object") {
    return payload.prediction;
  }
  if (
    payload.playoff_probability != null ||
    payload.playoffProbability != null ||
    payload.expected_wins != null ||
    payload.expectedWins != null
  ) {
    return payload;
  }
  return null;
}

function showMockData() {
  updatePredictionDisplay({
    playoff_probability: 0.78,
    division_probability: 0.22,
    superbowl_probability: 0.094,
    proj_wins: 11.2,
  });
}

function updatePredictionDisplay(pred) {
  if (!pred) return;

  const playoff = pick(pred, ["playoff_probability", "playoffProbability"]);
  const division = pick(pred, ["division_probability", "divisionProbability"]);
  const superbowl = pick(pred, [
    "superbowl_probability",
    "superBowlProbability",
    "superbowlProbability",
  ]);
  const projWins = pick(pred, [
    "proj_wins",
    "projectedWins",
    "projWins",
    "expected_wins",
    "expectedWins",
  ]);

  setText("playoff-prob", `${toPercent(playoff)}%`);
  setText("division-prob", `${toPercent(division)}%`);
  setText("superbowl-prob", `${toPercentOneDecimal(superbowl)}%`);

  requestAnimationFrame(() => {
    setWidth("playoff-bar", toPercent(playoff));
  });

  if (projWins != null) {
    setText("proj-wins", Number(projWins).toFixed(1));
  }
}

async function fetchJSON(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    const msg = networkErr.message || String(networkErr);
    throw new Error(
      `Network/CORS failure (${msg}). If this is CORS, add this landing origin to FRONTEND_URL in Railway.`
    );
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
  }

  return res.json();
}

function logApiError(endpoint, err) {
  console.warn(`[Cowboys IQ] ${endpoint} failed:`, err.message || err);
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] != null) return obj[key];
  }
  return null;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;

  if (id === "playoff-prob") {
    const num = String(text).replace("%", "");
    el.innerHTML = `${num}<i>%</i>`;
    return;
  }

  el.textContent = text;
}

function setWidth(id, percent) {
  const el = document.getElementById(id);
  if (!el) return;

  if (el instanceof SVGPathElement) {
    el.setAttribute("stroke-dasharray", `${percent} 100`);
    return;
  }

  el.style.width = `${percent}%`;
}

function toPercent(value) {
  if (value == null) return 0;
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function toPercentOneDecimal(value) {
  if (value == null) return "0.0";
  const n = Number(value);
  if (Number.isNaN(n)) return "0.0";
  return n <= 1 ? (n * 100).toFixed(1) : n.toFixed(1);
}

const FAN_KEY = "fanVote2025";
let fanConfidence = 65;

function setupFanConfidence() {
  const saved = localStorage.getItem(FAN_KEY);
  if (saved) fanConfidence = parseInt(saved, 10);
  updateFanMeter();

  const up = document.getElementById("vote-up");
  const down = document.getElementById("vote-down");
  if (up) up.addEventListener("click", () => handleFanVote(true));
  if (down) down.addEventListener("click", () => handleFanVote(false));
}

function handleFanVote(upvote) {
  if (localStorage.getItem(`${FAN_KEY}_voted`)) {
    flashAlreadyVoted();
    return;
  }

  fanConfidence = Math.min(100, Math.max(0, fanConfidence + (upvote ? 5 : -5)));
  localStorage.setItem(FAN_KEY, String(fanConfidence));
  localStorage.setItem(`${FAN_KEY}_voted`, "true");
  updateFanMeter();
}

function flashAlreadyVoted() {
  const val = document.getElementById("fan-meter-value");
  if (!val) return;

  const original = val.textContent;
  val.textContent = "Voted";
  setTimeout(() => {
    val.textContent = original;
  }, 1200);
}

function updateFanMeter() {
  const bar = document.getElementById("fan-meter");
  const val = document.getElementById("fan-meter-value");
  if (bar) bar.style.width = `${fanConfidence}%`;
  if (val) val.textContent = `${fanConfidence}%`;
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (event) {
      const id = this.getAttribute("href");
      if (!id || id.length < 2) return;

      const target = document.querySelector(id);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}
