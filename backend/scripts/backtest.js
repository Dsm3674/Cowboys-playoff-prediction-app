#!/usr/bin/env node
"use strict";

/**
 * Backtest the model on a finished season from ESPN data.
 *
 *   npm run backtest                 # last season
 *   npm run backtest -- 2024         # a specific season
 *   npm run backtest -- 2024 --tune  # also grid-search K and home field
 */

const { getNFLSeasonYear } = require("../services/espn");
const { runBacktest, tuneParameters } = require("../services/backtest");

const pct = (x) => (x == null ? "  n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x) => (x == null ? "n/a" : x.toFixed(4));

async function main() {
  const args = process.argv.slice(2);
  const year = Number(args.find((a) => /^\d{4}$/.test(a))) || getNFLSeasonYear() - 1;
  const tune = args.includes("--tune");

  console.log(`Backtesting the ${year} season…\n`);
  const out = await runBacktest({ year });
  const g = out.games;

  console.log(`GAME PICKS (${g.n} games, ratings rebuilt before each week)`);
  console.log(`  model            Brier ${num(g.brier)}  log loss ${num(g.logLoss)}  accuracy ${pct(g.accuracy)}`);
  console.log(`  home field only  Brier ${num(g.baselines.homeFieldOnly.brier)}  accuracy ${pct(g.baselines.homeFieldOnly.accuracy)}`);
  console.log(`  coin flip        Brier ${num(g.baselines.coinFlip.brier)}`);
  console.log("  calibration (predicted → observed):");
  for (const b of g.calibration) {
    console.log(`    ${pct(b.from)}–${pct(b.to)}  n=${String(b.n).padStart(3)}  ${pct(b.predicted)} → ${pct(b.observed)}`);
  }

  console.log(`\nPLAYOFF ODDS (actual field: ${out.playoffs.actualPlayoffTeams.join(", ")})`);
  for (const c of out.playoffs.checkpoints) {
    const misses = c.biggestMisses.map((m) => `${m.code} ${m.playoffPct}%${m.madePlayoffs ? " (made it)" : " (missed)"}`).join(", ");
    console.log(`  after week ${String(c.afterWeek).padStart(2)}  Brier ${num(c.brier)}  vs naive ${num(c.baselineBrier)}  misses: ${misses}`);
  }

  if (tune) {
    console.log("\nPARAMETER GRID (game-level Brier, best first)");
    for (const r of (await tuneParameters({ year })).slice(0, 8)) {
      console.log(`  K=${String(r.k).padStart(2)}  HFA=${String(r.homeField).padStart(2)}  Brier ${num(r.brier)}  accuracy ${pct(r.accuracy)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
