import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";

/**
 * RatingsLabPage — the model transparency desk.
 * Elo power ratings with QB/injury news deltas, conditional playoff path
 * probabilities ("who benefits from an upset in the other conference"),
 * and validation against de-vigged Super Bowl futures.
 */

const SIM_CHOICES = [10000, 25000, 50000, 100000];
const ADJ_TAGS = ["QB", "INJURY", "TRADE", "OTHER"];

function fmtPct(v) {
  return v == null ? "—" : `${Number(v).toFixed(1)}%`;
}

function LiftChip({ value }) {
  if (value == null) return <span className="rlab-lift">—</span>;
  const up = value >= 0;
  return (
    <span className={`rlab-lift ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)} pts
    </span>
  );
}

function SpecIcon({ kind }) {
  const stroke = "rgba(255,255,255,0.55)";
  const common = { fill: "none", stroke, strokeWidth: 1 };
  return (
    <svg viewBox="0 0 96 96" className="rlab-spec__icon" aria-hidden="true">
      {kind === "rings" && [16, 26, 36, 44].map((r) => (
        <circle key={r} cx="48" cy="48" r={r} {...common} />
      ))}
      {kind === "orbit" && (
        <>
          <circle cx="48" cy="48" r="18" {...common} />
          <circle cx="48" cy="48" r="34" {...common} />
          <circle cx="48" cy="14" r="4" {...common} />
          <circle cx="78" cy="62" r="4" {...common} />
        </>
      )}
      {kind === "pulse" && (
        <>
          <circle cx="48" cy="48" r="40" {...common} />
          <path d="M14 52 L30 52 L38 30 L50 68 L58 44 L66 52 L82 52" {...common} />
        </>
      )}
      {kind === "stack" && [
        <circle key="a" cx="48" cy="40" r="26" {...common} />,
        <circle key="b" cx="48" cy="50" r="20" {...common} />,
        <circle key="c" cx="48" cy="58" r="13" {...common} />,
      ]}
      {kind === "burst" &&
        Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const r1 = i % 2 === 0 ? 14 : 22;
          return (
            <line
              key={i}
              x1={48 + Math.cos(a) * r1}
              y1={48 + Math.sin(a) * r1}
              x2={48 + Math.cos(a) * 40}
              y2={48 + Math.sin(a) * 40}
              {...common}
            />
          );
        })}
    </svg>
  );
}

function RatingsLabPage({ year, selectedTeam = "DAL" }) {
  const [ratings, setRatings] = useState(null);
  const [paths, setPaths] = useState(null);
  const [market, setMarket] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [focusTeam, setFocusTeam] = useState(selectedTeam || "DAL");
  const [iterations, setIterations] = useState(25000);
  const [loading, setLoading] = useState(true);
  const [pathLoading, setPathLoading] = useState(false);
  const [error, setError] = useState("");

  const [adjForm, setAdjForm] = useState({
    team: selectedTeam || "DAL", deltaElo: -60, tag: "QB",
    reason: "", expiresWeek: "", adminKey: ""
  });
  const [adjStatus, setAdjStatus] = useState("");

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, adj] = await Promise.all([
        api.getPowerRatings(year),
        api.getModelAdjustments().catch(() => ({ adjustments: [] })),
      ]);
      setRatings(r);
      setAdjustments(adj.adjustments || []);
    } catch (e) {
      setError(e.message || "Failed to load power ratings.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  const runPaths = useCallback(async (team = focusTeam, iters = iterations) => {
    setPathLoading(true);
    try {
      const [p, m] = await Promise.all([
        api.getPathProbabilities(team, year, iters),
        api.getMarketValidation(year, Math.min(iters, 25000)).catch(() => null),
      ]);
      setPaths(p);
      if (m) setMarket(m);
    } catch (e) {
      setError(e.message || "Path simulation failed.");
    } finally {
      setPathLoading(false);
    }
  }, [focusTeam, iterations, year]);

  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => { runPaths(); /* initial */ // eslint-disable-line react-hooks/exhaustive-deps
  }, []);

  const table = ratings?.ratings || [];
  const topCards = table.slice(0, 8);

  const focusConf = useMemo(() => {
    const row = table.find((t) => t.code === focusTeam);
    return row?.conference || "NFC";
  }, [table, focusTeam]);
  const oppConf = focusConf === "AFC" ? "NFC" : "AFC";
  const oppTopSeed = paths?.topSeeds?.[oppConf];

  const beneficiaries = useMemo(() => {
    if (!paths) return [];
    return paths.teams
      .filter((t) => t.conference === focusConf)
      .sort((a, b) => b.upsetLiftPts - a.upsetLiftPts);
  }, [paths, focusConf]);

  async function submitAdjustment(e) {
    e.preventDefault();
    setAdjStatus("");
    try {
      const payload = {
        team: adjForm.team,
        deltaElo: Number(adjForm.deltaElo),
        tag: adjForm.tag,
        reason: adjForm.reason,
        expiresWeek: adjForm.expiresWeek ? Number(adjForm.expiresWeek) : null,
      };
      await api.saveModelAdjustment(payload, adjForm.adminKey);
      setAdjStatus("Saved. Ratings will fold it in on the next refresh.");
      loadCore();
    } catch (err) {
      setAdjStatus(err.message || "Save failed — check the admin key.");
    }
  }

  function focusOn(code) {
    setFocusTeam(code);
    runPaths(code, iterations);
    document.getElementById("rlab-paths")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="rlab">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="rlab-hero reveal-up">
        <div className="rlab-kicker">‹ MODEL LAB / ELO · PATHS · MARKET</div>
        <h1 className="rlab-display">
          POWER<br />RATINGS
        </h1>
        <p className="rlab-hero__sub">
          Results-replayed Elo. Weekly QB and injury deltas. Path-conditional
          playoff odds, validated against de-vigged futures markets.
        </p>
        <div className="rlab-chip-row">
          <span className="rlab-chip">{iterations.toLocaleString()} SIMS / RUN</span>
          <span className="rlab-chip">
            {ratings?.lastCompletedWeek
              ? `SYNCED THRU WEEK ${ratings.lastCompletedWeek}`
              : "AWAITING WEEK 1 RESULTS"}
          </span>
          <span className="rlab-chip">{ratings?.gamesRated ?? 0} GAMES RATED</span>
        </div>
        <div className="rlab-hero__controls">
          <select
            className="rlab-select"
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            aria-label="Simulations per run"
          >
            {SIM_CHOICES.map((n) => (
              <option key={n} value={n}>{n.toLocaleString()} sims</option>
            ))}
          </select>
          <button
            className="rlab-btn"
            disabled={pathLoading}
            onClick={() => runPaths(focusTeam, iterations)}
          >
            {pathLoading ? "SIMULATING…" : "RUN PATH SIM"}
          </button>
        </div>
        {error && <div className="rlab-error">{error}</div>}
      </section>

      {/* ── Spec tiles ───────────────────────────────────────── */}
      <section className="rlab-spec-grid reveal-up">
        {[
          { icon: "rings", label: "MOV-weighted · K=20 · HFA +48", title: "RATINGS" },
          { icon: "orbit", label: "Every result replayed, auto-weekly", title: "CADENCE" },
          { icon: "pulse", label: "QB & injury Elo deltas, expiring", title: "ADJUSTMENTS" },
          { icon: "stack", label: "NFL reseeding · neutral-site SB", title: "SIMULATION" },
          { icon: "burst", label: "De-vigged Super Bowl futures", title: "VALIDATION" },
        ].map((s) => (
          <div key={s.title} className="rlab-spec">
            <SpecIcon kind={s.icon} />
            <div className="rlab-spec__label">{s.label}</div>
            <div className="rlab-spec__title">{s.title}</div>
          </div>
        ))}
      </section>

      {/* ── Rating cards ─────────────────────────────────────── */}
      <section className="rlab-section">
        <div className="rlab-section__head">
          <h2 className="rlab-h2">THE BOARD</h2>
          <span className="rlab-meta">{ratings?.system || ""}</span>
        </div>
        {loading ? (
          <div className="rlab-loading">Replaying the season…</div>
        ) : (
          <div className="rlab-card-grid">
            {topCards.map((t) => (
              <div key={t.code} className="rlab-card">
                <span className="rlab-chip rlab-card__chip">ELO {Math.round(t.adjustedElo)}</span>
                <div className="rlab-card__rank">#{t.rank}</div>
                <h3 className="rlab-card__title">{t.code}</h3>
                <p className="rlab-card__sub">{t.name}</p>
                <p className="rlab-card__line">
                  {t.record?.wins}-{t.record?.losses}
                  {t.record?.ties ? `-${t.record.ties}` : ""} · {t.pointDiffPerGame > 0 ? "+" : ""}
                  {t.pointDiffPerGame}/gm
                  {t.newsDelta !== 0 && (
                    <span className={t.newsDelta > 0 ? "rlab-pos" : "rlab-neg"}>
                      {" "}· news {t.newsDelta > 0 ? "+" : ""}{t.newsDelta}
                    </span>
                  )}
                </p>
                <button className="rlab-btn rlab-btn--card" onClick={() => focusOn(t.code)}>
                  SET FOCUS
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="rlab-table-wrap">
            <table className="rlab-table">
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>Conf</th><th>Record</th>
                  <th>Elo</th><th>News Δ</th><th>Eff Δ</th><th>Power</th>
                </tr>
              </thead>
              <tbody>
                {table.map((t) => (
                  <tr
                    key={t.code}
                    className={t.code === focusTeam ? "focused" : ""}
                    onClick={() => focusOn(t.code)}
                  >
                    <td>{t.rank}</td>
                    <td className="rlab-table__team">{t.name}</td>
                    <td>{t.conference}</td>
                    <td>
                      {t.record?.wins}-{t.record?.losses}
                      {t.record?.ties ? `-${t.record.ties}` : ""}
                    </td>
                    <td>{t.elo}</td>
                    <td className={t.newsDelta > 0 ? "rlab-pos" : t.newsDelta < 0 ? "rlab-neg" : ""}>
                      {t.newsDelta > 0 ? "+" : ""}{t.newsDelta || 0}
                    </td>
                    <td>{t.efficiencyDelta > 0 ? "+" : ""}{t.efficiencyDelta}</td>
                    <td className="rlab-table__power">{t.power}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Path lab ─────────────────────────────────────────── */}
      <section className="rlab-section" id="rlab-paths">
        <div className="rlab-section__head">
          <h2 className="rlab-h2">
            WHO BENEFITS FROM AN {oppConf} UPSET
          </h2>
          <span className="rlab-meta">
            Condition: {oppConf} #1 seed{oppTopSeed ? ` (${oppTopSeed})` : ""} misses the Super Bowl
          </span>
        </div>

        {pathLoading && <div className="rlab-loading">Running {iterations.toLocaleString()} brackets…</div>}

        {paths && !pathLoading && (
          <>
            <div className="rlab-table-wrap">
              <table className="rlab-table">
                <thead>
                  <tr>
                    <th>Seed</th><th>Team ({focusConf})</th><th>Reach CC</th><th>Reach SB</th>
                    <th>Win SB</th><th>Win SB | {oppConf} upset</th><th>Upset lift</th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.map((t) => (
                    <tr key={t.code} className={t.code === focusTeam ? "focused" : ""}>
                      <td>{t.seed}</td>
                      <td className="rlab-table__team">{t.name}</td>
                      <td>{fmtPct(t.reachCCPct)}</td>
                      <td>{fmtPct(t.reachSBPct)}</td>
                      <td>{fmtPct(t.winSBPct)}</td>
                      <td>{fmtPct(t.winSBGivenOppUpsetPct)}</td>
                      <td><LiftChip value={t.upsetLiftPts} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rlab-duo">
              <div className="rlab-panel">
                <div className="rlab-panel__title">
                  {focusTeam} — SUPER BOWL OPPONENT BOOK
                </div>
                {paths.focusInField ? (
                  paths.opponentBreakdown.length ? (
                    <table className="rlab-table rlab-table--tight">
                      <thead>
                        <tr><th>Opponent</th><th>Meet in SB</th><th>Win if met</th><th>Joint title</th></tr>
                      </thead>
                      <tbody>
                        {paths.opponentBreakdown.map((o) => (
                          <tr key={o.opponent}>
                            <td className="rlab-table__team">{o.opponent}</td>
                            <td>{fmtPct(o.meetSBPct)}</td>
                            <td>{fmtPct(o.winSBGivenOpponentPct)}</td>
                            <td>{fmtPct(o.jointWinPct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="rlab-muted">No SB appearances in this run.</p>
                  )
                ) : (
                  <p className="rlab-muted">
                    {focusTeam} misses the projected field — pick a playoff team from the board.
                  </p>
                )}
              </div>

              <div className="rlab-panel">
                <div className="rlab-panel__title">{focusTeam} — EXIT ROUNDS</div>
                {paths.focusInField ? (
                  <div className="rlab-exit-bars">
                    {[
                      ["Wild Card", paths.focusRoundExits.WILD_CARD],
                      ["Divisional", paths.focusRoundExits.DIVISIONAL],
                      ["Conf Champ", paths.focusRoundExits.CONF_CHAMPIONSHIP],
                      ["SB Loss", paths.focusRoundExits.SB_LOSS],
                      ["SB WIN", paths.focusRoundExits.SB_WIN],
                    ].map(([label, count]) => {
                      const p = (count / paths.iterations) * 100;
                      return (
                        <div key={label} className="rlab-exit-row">
                          <span className="rlab-exit-label">{label}</span>
                          <div className="rlab-exit-track">
                            <div
                              className={`rlab-exit-fill${label === "SB WIN" ? " win" : ""}`}
                              style={{ width: `${Math.max(1.5, p)}%` }}
                            />
                          </div>
                          <span className="rlab-exit-val">{p.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rlab-muted">Out of the field at current seeding.</p>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Market check ─────────────────────────────────────── */}
      <section className="rlab-section">
        <div className="rlab-section__head">
          <h2 className="rlab-h2">MARKET CHECK</h2>
          <span className="rlab-meta">
            {market
              ? `Futures ${market.market.asOf} · overround ${market.market.overroundPct}% removed`
              : "De-vigged Super Bowl futures"}
          </span>
        </div>
        {market ? (
          <>
            <div className="rlab-stat-row">
              <div className="rlab-stat">
                <div className="rlab-stat__val">{market.summary.correlation}</div>
                <div className="rlab-stat__label">MODEL ↔ MARKET CORRELATION</div>
              </div>
              <div className="rlab-stat">
                <div className="rlab-stat__val">{market.summary.meanAbsEdgePts} pts</div>
                <div className="rlab-stat__label">MEAN ABSOLUTE EDGE</div>
              </div>
              <div className="rlab-stat">
                <div className="rlab-stat__val">
                  {market.summary.largestDivergence?.code || "—"}
                </div>
                <div className="rlab-stat__label">LARGEST DIVERGENCE</div>
              </div>
            </div>
            <div className="rlab-table-wrap">
              <table className="rlab-table">
                <thead>
                  <tr><th>Team</th><th>Model SB%</th><th>Market SB%</th><th>Edge</th></tr>
                </thead>
                <tbody>
                  {market.rows.slice(0, 16).map((r) => (
                    <tr key={r.code}>
                      <td className="rlab-table__team">{r.code}{!r.inModelField ? " *" : ""}</td>
                      <td>{fmtPct(r.modelPct)}</td>
                      <td>{fmtPct(r.marketPct)}</td>
                      <td><LiftChip value={r.edgePts} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rlab-muted rlab-footnote">
              * outside the model's projected playoff field. A high correlation with
              a few explained divergences is the healthy state — matching the market
              exactly would mean the model adds nothing.
            </p>
          </>
        ) : (
          <div className="rlab-loading">Loading market snapshot…</div>
        )}
      </section>

      {/* ── Adjustments desk ─────────────────────────────────── */}
      <section className="rlab-section">
        <div className="rlab-section__head">
          <h2 className="rlab-h2">NEWS DESK</h2>
          <span className="rlab-meta">QB &amp; injury Elo deltas · admin key required to write</span>
        </div>

        <div className="rlab-duo">
          <div className="rlab-panel">
            <div className="rlab-panel__title">ACTIVE ADJUSTMENTS</div>
            {adjustments.length ? (
              <table className="rlab-table rlab-table--tight">
                <thead>
                  <tr><th>Team</th><th>Δ Elo</th><th>Tag</th><th>Reason</th><th>Expires</th></tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={`${a.team}-${a.tag}`}>
                      <td className="rlab-table__team">{a.team}</td>
                      <td className={a.deltaElo > 0 ? "rlab-pos" : "rlab-neg"}>
                        {a.deltaElo > 0 ? "+" : ""}{a.deltaElo}
                      </td>
                      <td>{a.tag}</td>
                      <td className="rlab-reason">{a.reason}</td>
                      <td>{a.expiresWeek ? `wk ${a.expiresWeek}` : "open"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rlab-muted">
                No active deltas. Ratings are running on pure results.
              </p>
            )}
          </div>

          <form className="rlab-panel" onSubmit={submitAdjustment}>
            <div className="rlab-panel__title">POST AN UPDATE</div>
            <div className="rlab-form-grid">
              <label>
                Team
                <select
                  className="rlab-select"
                  value={adjForm.team}
                  onChange={(e) => setAdjForm({ ...adjForm, team: e.target.value })}
                >
                  {table.map((t) => <option key={t.code} value={t.code}>{t.code}</option>)}
                </select>
              </label>
              <label>
                Δ Elo (±150)
                <input
                  className="rlab-input" type="number" min="-150" max="150" required
                  value={adjForm.deltaElo}
                  onChange={(e) => setAdjForm({ ...adjForm, deltaElo: e.target.value })}
                />
              </label>
              <label>
                Tag
                <select
                  className="rlab-select"
                  value={adjForm.tag}
                  onChange={(e) => setAdjForm({ ...adjForm, tag: e.target.value })}
                >
                  {ADJ_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Expires wk
                <input
                  className="rlab-input" type="number" min="1" max="22"
                  placeholder="open"
                  value={adjForm.expiresWeek}
                  onChange={(e) => setAdjForm({ ...adjForm, expiresWeek: e.target.value })}
                />
              </label>
              <label className="rlab-form-wide">
                Reason
                <input
                  className="rlab-input" type="text" required maxLength={200}
                  placeholder="e.g. QB1 out (ankle) — backup starts vs PHI"
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                />
              </label>
              <label className="rlab-form-wide">
                Admin key
                <input
                  className="rlab-input" type="password" required
                  value={adjForm.adminKey}
                  onChange={(e) => setAdjForm({ ...adjForm, adminKey: e.target.value })}
                />
              </label>
            </div>
            <button className="rlab-btn" type="submit">POST ADJUSTMENT</button>
            {adjStatus && <div className="rlab-form-status">{adjStatus}</div>}
          </form>
        </div>
      </section>

      {/* ── Wordmark strip ───────────────────────────────────── */}
      <div className="rlab-wordmark" aria-hidden="true">LONESTAR</div>
    </div>
  );
}

export default RatingsLabPage;
