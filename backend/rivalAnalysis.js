"use strict";

const { computeTSI } = require("./tsi");

const RIVAL_TEAMS = [
  { code: "PHI", name: "Eagles", tier: "direct_rival", conference: "NFC", division: "NFC East" },
  { code: "WAS", name: "Commanders", tier: "direct_rival", conference: "NFC", division: "NFC East" },
  { code: "NYG", name: "Giants", tier: "direct_rival", conference: "NFC", division: "NFC East" },
  { code: "SF", name: "49ers", tier: "threat", conference: "NFC", division: "NFC West" },
  { code: "TB", name: "Buccaneers", tier: "threat", conference: "NFC", division: "NFC South" },
  { code: "NO", name: "Saints", tier: "threat", conference: "NFC", division: "NFC South" },
  { code: "ATL", name: "Falcons", tier: "threat", conference: "NFC", division: "NFC South" },
  { code: "LAR", name: "Rams", tier: "threat", conference: "NFC", division: "NFC West" },
  { code: "SEA", name: "Seahawks", tier: "threat", conference: "NFC", division: "NFC West" },
  { code: "KC", name: "Chiefs", tier: "cross_conference", conference: "AFC", division: "AFC West" },
  { code: "BUF", name: "Bills", tier: "cross_conference", conference: "AFC", division: "AFC East" },
  { code: "MIA", name: "Dolphins", tier: "cross_conference", conference: "AFC", division: "AFC East" },
  { code: "BAL", name: "Ravens", tier: "cross_conference", conference: "AFC", division: "AFC North" }
];

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(asNumber(value, 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tierWeight(tier) {
  if (tier === "direct_rival") return 1.35;
  if (tier === "threat") return 1.0;
  return 0.45;
}

function urgencyFromScore(score) {
  if (score >= 82) return "critical";
  if (score >= 62) return "high";
  if (score >= 38) return "medium";
  return "low";
}

function getRecord(meta) {
  return meta?.record || {};
}

function getWinPct(teamData) {
  return asNumber(teamData?.meta?.record?.winPct, 0.5);
}

function getWins(teamData) {
  return asNumber(teamData?.meta?.record?.wins, 0);
}

function getLosses(teamData) {
  return asNumber(teamData?.meta?.record?.losses, 0);
}

function getGamesPlayed(teamData) {
  const record = getRecord(teamData?.meta);
  const wins = asNumber(record?.wins, 0);
  const losses = asNumber(record?.losses, 0);
  return wins + losses;
}

function normalizeTeamResult(teamConfig, tsiResult) {
  return {
    code: teamConfig.code,
    name: teamConfig.name,
    tier: teamConfig.tier,
    conference: teamConfig.conference,
    division: teamConfig.division,
    tsi: asNumber(tsiResult?.tsi, 0),
    components: tsiResult?.components || {},
    meta: tsiResult?.meta || {},
    year: tsiResult?.year || null
  };
}

function compareThreats(a, b) {
  if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
  if (b.tsi !== a.tsi) return b.tsi - a.tsi;
  return b.winProbability - a.winProbability;
}

function buildCowboysSnapshot(cowboys) {
  const winPct = getWinPct(cowboys);
  const wins = getWins(cowboys);
  const losses = getLosses(cowboys);
  const baselinePlayoffProbability = round(
    clamp(
      winPct * 100 +
        (cowboys.tsi - 50) * 0.45 +
        (wins - losses) * 1.25,
      5,
      97
    ),
    1
  );

  return {
    tsi: round(cowboys.tsi, 1),
    baselinePlayoffProbability,
    components: cowboys.components,
    record: cowboys.meta?.record || {}
  };
}

function buildCompetitionContext(cowboys, rivals) {
  const nfcRivals = rivals.filter((team) => team.conference === "NFC");
  const nfcWithCowboys = [...nfcRivals, cowboys].sort((a, b) => {
    const winPctDelta = getWinPct(b) - getWinPct(a);
    if (winPctDelta !== 0) return winPctDelta;
    return b.tsi - a.tsi;
  });

  const nfcRank = nfcWithCowboys.findIndex((team) => team.code === "DAL") + 1;
  const strongerNfcTeams = nfcRivals.filter(
    (team) =>
      getWinPct(team) > getWinPct(cowboys) ||
      (getWinPct(team) === getWinPct(cowboys) && team.tsi > cowboys.tsi)
  );

  const divisionLeadersAhead = nfcRivals.filter(
    (team) =>
      team.division === "NFC East" &&
      (getWinPct(team) > getWinPct(cowboys) ||
        (getWinPct(team) === getWinPct(cowboys) && team.tsi > cowboys.tsi))
  );

  return {
    nfcRank,
    strongerNfcTeamCount: strongerNfcTeams.length,
    divisionLeadersAhead: divisionLeadersAhead.length
  };
}

function calculateRivalImpact(rival, cowboys, context) {
  const rivalWinPct = getWinPct(rival);
  const cowboysWinPct = getWinPct(cowboys);
  const rivalWins = getWins(rival);
  const cowboysWins = getWins(cowboys);

  const winPctGap = rivalWinPct - cowboysWinPct;
  const winGap = rivalWins - cowboysWins;
  const tsiGap = rival.tsi - cowboys.tsi;

  const sameConference = rival.conference === "NFC";
  const sameDivision = rival.division === "NFC East";

  const conferenceWeight = sameConference ? 1.0 : 0.45;
  const divisionWeight = sameDivision ? 1.25 : 1.0;
  const baseWeight = tierWeight(rival.tier);

  const pressureRaw =
    baseWeight *
    conferenceWeight *
    divisionWeight *
    (
      35 +
      tsiGap * 0.9 +
      winPctGap * 120 +
      winGap * 4 +
      (sameDivision ? 12 : 0)
    );

  const impactScore = round(clamp(pressureRaw, 0, 100), 1);

  const desiredOutcome = sameConference ? "Loss" : "Either";
  const playoffImpactPercentage = round(
    sameConference
      ? clamp(impactScore * 0.18 + Math.max(0, winPctGap) * 22, 0, 25)
      : clamp(impactScore * 0.07, 0, 8),
    2
  );

  const winProbability = round(clamp(rivalWinPct * 100, 0, 100), 1);

  const recordPressure = round(
    clamp((rivalWins - cowboysWins) * 2.5 + Math.max(0, winPctGap) * 40, 0, 25),
    2
  );

  const tsiPressure = round(
    clamp(Math.max(0, tsiGap) * 0.35, 0, 20),
    2
  );

  const divisionalPressure = round(sameDivision ? clamp(12 + Math.max(0, winGap) * 2, 0, 22) : 0, 2);
  const conferencePressure = round(sameConference ? clamp(8 + Math.max(0, tsiGap) * 0.1, 0, 18) : 4, 2);

  const expectedImpact = round(
    clamp(
      recordPressure + tsiPressure + divisionalPressure + conferencePressure,
      0,
      100
    ),
    1
  );

  const bestCaseScenario = round(
    clamp(
      cowboys.baselinePlayoffProbability + playoffImpactPercentage,
      0,
      100
    ),
    1
  );

  const worstCaseScenario = round(
    clamp(
      cowboys.baselinePlayoffProbability - playoffImpactPercentage,
      0,
      100
    ),
    1
  );

  return {
    team: rival.code,
    teamName: rival.name,
    tier: rival.tier,
    conference: rival.conference,
    division: rival.division,
    tsi: round(rival.tsi, 1),
    components: rival.components,
    impactScore,
    urgency: urgencyFromScore(impactScore),
    winProbability,
    recommendedOutcome: desiredOutcome,
    playoffImpactPercentage,
    bestCaseScenario,
    worstCaseScenario,
    expectedImpact,
    simulation: {
      deterministic: true,
      iterationsUsed: 0,
      varianceRemoved: true
    },
    breakdown: {
      recordPressure,
      tsiPressure,
      divisionalPressure,
      conferencePressure,
      nfcRankOfCowboys: context.nfcRank
    }
  };
}

function rankGamesByImpact(rivalImpacts) {
  return [...rivalImpacts].sort(compareThreats);
}

function buildSummary(cowboys, rivalImpacts, context) {
  const directRivals = rivalImpacts.filter((team) => team.tier === "direct_rival");
  const nfcThreats = rivalImpacts.filter((team) => team.conference === "NFC");
  const highestImpact = rivalImpacts[0] || null;
  const topDirect = [...directRivals].sort(compareThreats)[0] || null;
  const topConferenceThreat = [...nfcThreats].sort(compareThreats)[0] || null;

  const aggregatePressure = round(
    rivalImpacts.reduce((sum, team) => sum + team.impactScore, 0),
    1
  );

  return {
    aggregatePressure,
    nfcRank: context.nfcRank,
    strongerNfcTeamCount: context.strongerNfcTeamCount,
    divisionLeadersAhead: context.divisionLeadersAhead,
    highestImpactTeam: highestImpact
      ? {
          team: highestImpact.team,
          teamName: highestImpact.teamName,
          impactScore: highestImpact.impactScore
        }
      : null,
    topDirectRival: topDirect
      ? {
          team: topDirect.team,
          teamName: topDirect.teamName,
          impactScore: topDirect.impactScore
        }
      : null,
    topConferenceThreat: topConferenceThreat
      ? {
          team: topConferenceThreat.team,
          teamName: topConferenceThreat.teamName,
          impactScore: topConferenceThreat.impactScore
        }
      : null,
    narrative:
      highestImpact && highestImpact.conference === "NFC"
        ? `${highestImpact.teamName} currently creates the most playoff pressure on Dallas based on real TSI and record context.`
        : "No single NFC rival is currently separating strongly from Dallas in the available data."
  };
}

async function fetchTeamData(teamConfig, year) {
  const result = await computeTSI({
    teamAbbr: teamConfig.code,
    year
  });

  return normalizeTeamResult(teamConfig, result);
}

async function computeRivalImpact(options = {}) {
  const year = Number(options.year) || undefined;

  const cowboys = await computeTSI({
    teamAbbr: "DAL",
    year
  });

  if (!cowboys) {
    throw new Error("Unable to load Cowboys data for rival impact analysis.");
  }

  const normalizedCowboys = normalizeTeamResult(
    {
      code: "DAL",
      name: "Cowboys",
      tier: "self",
      conference: "NFC",
      division: "NFC East"
    },
    cowboys
  );

  const settled = await Promise.allSettled(
    RIVAL_TEAMS.map((team) => fetchTeamData(team, year))
  );

  const rivals = [];
  const unavailableTeams = [];

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const team = RIVAL_TEAMS[i];

    if (outcome.status === "fulfilled") {
      rivals.push(outcome.value);
    } else {
      unavailableTeams.push({
        team: team.code,
        teamName: team.name,
        error: outcome.reason?.message || "Unknown error"
      });
    }
  }

  const context = buildCompetitionContext(normalizedCowboys, rivals);
  const cowboysSnapshot = buildCowboysSnapshot(normalizedCowboys);

  const rivalImpacts = rivals
    .map((rival) => calculateRivalImpact(
      rival,
      { ...normalizedCowboys, baselinePlayoffProbability: cowboysSnapshot.baselinePlayoffProbability },
      context
    ))
    .sort(compareThreats);

  const rankedGames = rankGamesByImpact(rivalImpacts);
  const summary = buildSummary(cowboysSnapshot, rivalImpacts, context);

  return {
    success: true,
    deterministic: true,
    timestamp: new Date().toISOString(),
    year: normalizedCowboys.year,
    parameters: {
      chaos: 0,
      iterations: 0,
      removedSyntheticVariance: true
    },
    cowboys: cowboysSnapshot,
    rivalImpacts,
    rankedGames,
    summary,
    unavailableTeams
  };
}

module.exports = {
  computeRivalImpact
};
