#!/usr/bin/env node
"use strict";

/**
 * Backtest the model on finished seasons (nflverse data, ESPN fallback).
 *
 *   npm run backtest                    # last five seasons
 *   npm run backtest -- 2018 2025       # a range
 *   npm run backtest -- 2018 2025 --tune  # also grid-search K and home field
 *
 * Set NFLVERSE_GAMES_FILE to a local games.csv to run offline.
 */

const { runBacktest, tuneParameters } = require("../services/backtest");

const pct = (x) => (x == null ? "  n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x) => (x == null ? "n/a" : x.toFixed(4));

async function main() {
  const args = process.argv.slice(2);
  const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
  const tune = args.includes("--tune");
  const [from, to] = years.length === 1 ? [years[0], years[0]] : years;

  const out = await runBacktest({ from, to });
  const g = out.games;
  console.log(`Backtest ${out.from}-${out.to} (${out.sources.join(", ")} data)\n`);

  console.log(`GAME PICKS (${g.n} games, ratings rebuilt before each week)`);
  console.log(`  model            Brier ${num(g.brier)}  log loss ${num(g.logLoss)}  accuracy ${pct(g.accuracy)}`);
  if (g.baselines.vegas) {
    console.log(`  Vegas closing    Brier ${num(g.baselines.vegas.brier)}  accuracy ${pct(g.baselines.vegas.accuracy)}  (${g.baselines.vegas.n} games)`);
  }
  console.log(`  home field only  Brier ${num(g.baselines.homeFieldOnly.brier)}`);
  console.log(`  coin flip        Brier ${num(g.baselines.coinFlip.brier)}`);
  console.log("  calibration (predicted → observed):");
  for (const b of g.calibration) {
    console.log(`    ${pct(b.from)}–${pct(b.to)}  n=${String(b.n).padStart(4)}  ${pct(b.predicted)} → ${pct(b.observed)}`);
  }

  console.log("\nPLAYOFF ODDS (all teams, pooled across seasons)");
  for (const c of out.playoffs.checkpoints) {
    console.log(`  after week ${String(c.afterWeek).padStart(2)}  Brier ${num(c.brier)}  vs naive 14/32 ${num(c.baselineBrier)}`);
  }

  console.log("\nBY SEASON (game Brier: model / Vegas)");
  for (const s of out.seasons) {
    console.log(`  ${s.year}  ${num(s.games.brier)} / ${num(s.games.baselines.vegas?.brier ?? null)}  accuracy ${pct(s.games.accuracy)}`);
  }

  if (tune) {
    console.log("\nPARAMETER GRID (game-level Brier, best first)");
    for (const r of (await tuneParameters({ from: out.from, to: out.to })).slice(0, 8)) {
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
