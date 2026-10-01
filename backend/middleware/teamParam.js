"use strict";

const { resolveTeamCode } = require("../services/espn");

/**
 * Resolve a team parameter, or answer 400. Unknown codes used to flow into
 * ESPN lookups and come back as empty data with success: true.
 * Returns the code, or null after sending the error.
 */
function teamOr400(res, raw, fallback = "DAL") {
  const code = resolveTeamCode(raw, fallback);
  if (!code) {
    res.status(400).json({ success: false, error: `Unknown team "${raw}". Use a code like DAL or PHI.` });
    return null;
  }
  return code;
}

module.exports = { teamOr400 };
