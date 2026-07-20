"use strict";

const { computeTSI } = require("./tsi");
const { getNFLTeamCatalog, getNFLTeamMetadata } = require("./services/espn");
const { getEloSnapshot, blendWithElo, eloWinProb } = require("./services/ratingsEngine");

function normalizeTeamCode(code) {
  return String(code || "DAL").trim().toUpperCase();
}

function deriveTeamTier(subject, rival) {
  if (rival.conference === subject.conference) {
    if (rival.division === subject.division) return "direct_rival";
    return "threat";
  }
  return "cross_conference";
}

function resolveTeamConfig(code) {
  const normalized = normalizeTeamCode(code);
  const metadata = getNFLTeamMetadata(normalized);
  return {
    code: normalized,
    name: metadata?.displayName || normalized,
    conference: metadata?.conference || "NFC",
    division: metadata?.division || null
  };
}

function buildCompetitionTeams(subject) {
  const catalog = getNFLTeamCatalog();
  return catalog
    .filter((team) => team.abbreviation !== subject.code)
    .map((team) => ({
      code: team.abbreviation,
      name: team.displayName,
      conference: team.conference,
      division: team.division,
      tier: deriveTeamTier(subject, team)
    }));
}

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

function buildTeamSnapshot(team) {
  const winPct = getWinPct(team);
  const wins = getWins(team);
  const losses = getLosses(team);
  const baselinePlayoffProbability = round(
    clamp(
      winPct * 100 +
        (team.tsi - 50) * 0.45 +
        (wins - losses) * 1.25,
      5,
      97
    ),
    1
  );

  return {
    code: team.code,
    name: team.name,
    conference: team.conference,
    division: team.division,
    tsi: round(team.tsi, 1),
    baselinePlayoffProbability,
    components: team.components,
    record: team.meta?.record || {}
  };
}

function buildCompetitionContext(subject, rivals) {
  const conferenceRivals = rivals.filter((team) => team.conference === subject.conference);
  const conferenceWithSubject = [...conferenceRivals, subject].sort((a, b) => {
    const winPctDelta = getWinPct(b) - getWinPct(a);
    if (winPctDelta !== 0) return winPctDelta;
    return b.tsi - a.tsi;
  });

  const conferenceRank = conferenceWithSubject.findIndex((team) => team.code === subject.code) + 1;
  const strongerConferenceTeams = conferenceRivals.filter(
    (team) =>
      getWinPct(team) > getWinPct(subject) ||
      (getWinPct(team) === getWinPct(subject) && team.tsi > subject.tsi)
  );

  const divisionLeadersAhead = conferenceRivals.filter(
    (team) =>
      team.division === subject.division &&
      (getWinPct(team) > getWinPct(subject) ||
        (getWinPct(team) === getWinPct(subject) && team.tsi > subject.tsi))
  );

  return {
    conferenceRank,
    strongerConferenceTeamCount: strongerConferenceTeams.length,
    divisionLeadersAhead: divisionLeadersAhead.length
  };
}

function calculateRivalImpact(rival, subject, context) {
  const rivalWinPct = getWinPct(rival);
  const subjectWinPct = getWinPct(subject);
  const rivalWins = getWins(rival);
  const subjectWins = getWins(subject);

  const winPctGap = rivalWinPct - subjectWinPct;
  const winGap = rivalWins - subjectWins;
  const tsiGap = rival.tsi - subject.tsi;
  const eloGap =
    Number.isFinite(rival.elo) && Number.isFinite(subject.elo)
      ? rival.elo - subject.elo
      : 0;

  const sameConference = rival.conference === subject.conference;
  const sameDivision = rival.division === subject.division;

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
      eloGap * 0.06 +
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

  const winProbability = round(
    clamp(
      (Number.isFinite(rival.elo)
        ? blendWithElo(rivalWinPct, eloWinProb(rival.elo, 1500, 0), 0.5)
        : rivalWinPct) * 100,
      0,
      100
    ),
    1
  );

  const recordPressure = round(
    clamp((rivalWins - subjectWins) * 2.5 + Math.max(0, winPctGap) * 40, 0, 25),
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
      subject.baselinePlayoffProbability + playoffImpactPercentage,
      0,
      100
    ),
    1
  );

  const worstCaseScenario = round(
    clamp(
      subject.baselinePlayoffProbability - playoffImpactPercentage,
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
      conferenceRank: context.conferenceRank
    }
  };
}

function rankGamesByImpact(rivalImpacts) {
  return [...rivalImpacts].sort(compareThreats);
}

function buildSummary(subject, rivalImpacts, context) {
  const directRivals = rivalImpacts.filter((team) => team.tier === "direct_rival");
  const conferenceThreats = rivalImpacts.filter((team) => team.conference === subject.conference);
  const highestImpact = rivalImpacts[0] || null;
  const topDirect = [...directRivals].sort(compareThreats)[0] || null;
  const topConferenceThreat = [...conferenceThreats].sort(compareThreats)[0] || null;

  const aggregatePressure = round(
    rivalImpacts.reduce((sum, team) => sum + team.impactScore, 0),
    1
  );

  return {
    aggregatePressure,
    conferenceRank: context.conferenceRank,
    strongerConferenceTeamCount: context.strongerConferenceTeamCount,
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
      highestImpact
        ? `${highestImpact.teamName} currently creates the most playoff pressure on ${subject.name} based on real TSI and record context.`
        : `No single ${subject.conference} rival is currently separating strongly from ${subject.name} in the available data.`
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

  const normalizedTeamCode = normalizeTeamCode(options.teamAbbr);
  const teamConfig = resolveTeamConfig(normalizedTeamCode);

  const subjectData = await computeTSI({
    teamAbbr: normalizedTeamCode,
    year
  });

  if (!subjectData) {
    throw new Error(`Unable to load data for ${normalizedTeamCode} rival impact analysis.`);
  }

  const normalizedSubject = normalizeTeamResult(
    {
      code: subjectData.team || normalizedTeamCode,
      name: teamConfig.name,
      tier: "self",
      conference: teamConfig.conference,
      division: teamConfig.division
    },
    subjectData
  );

  const rivalTeams = buildCompetitionTeams(normalizedSubject);
  const settled = await Promise.allSettled(
    rivalTeams.map((team) => fetchTeamData(team, year))
  );

  const rivals = [];
  const unavailableTeams = [];

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const team = rivalTeams[i];

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

  // Fold the Elo engine into rival threat scoring.
  const eloSnap = await getEloSnapshot({ year });
  for (const team of [normalizedSubject, ...rivals]) {
    const power = eloSnap.byTeam[team.code]?.power;
    team.elo = eloSnap.available && Number.isFinite(power) ? power : null;
  }

  const context = buildCompetitionContext(normalizedSubject, rivals);
  const subjectSnapshot = buildTeamSnapshot(normalizedSubject);

  const rivalImpacts = rivals
    .map((rival) => calculateRivalImpact(
      rival,
      { ...normalizedSubject, baselinePlayoffProbability: subjectSnapshot.baselinePlayoffProbability },
      context
    ))
    .sort(compareThreats);

  const rankedGames = rankGamesByImpact(rivalImpacts);
  const summary = buildSummary(subjectSnapshot, rivalImpacts, context);

  return {
    success: true,
    deterministic: true,
    timestamp: new Date().toISOString(),
    year: normalizedSubject.year,
    parameters: {
      chaos: 0,
      iterations: 0,
      removedSyntheticVariance: true
    },
    team: subjectSnapshot,
    rivalImpacts,
    rankedGames,
    summary,
    unavailableTeams
  };
}

module.exports = {
  computeRivalImpact
};
