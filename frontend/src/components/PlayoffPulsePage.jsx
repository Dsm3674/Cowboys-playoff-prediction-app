const { useEffect, useMemo, useState } = React;

const PP_TEAMS = [
  { code: "DAL", name: "Dallas Cowboys", div: "NFC East", conf: "NFC" },
  { code: "PHI", name: "Philadelphia Eagles", div: "NFC East", conf: "NFC" },
  { code: "WAS", name: "Washington Commanders", div: "NFC East", conf: "NFC" },
  { code: "NYG", name: "New York Giants", div: "NFC East", conf: "NFC" },
  { code: "SF", name: "San Francisco 49ers", div: "NFC West", conf: "NFC" },
  { code: "DET", name: "Detroit Lions", div: "NFC North", conf: "NFC" },
  { code: "KC", name: "Kansas City Chiefs", div: "AFC West", conf: "AFC" },
  { code: "BAL", name: "Baltimore Ravens", div: "AFC North", conf: "AFC" },
  { code: "BUF", name: "Buffalo Bills", div: "AFC East", conf: "AFC" },
  { code: "HOU", name: "Houston Texans", div: "AFC South", conf: "AFC" },
  { code: "GB", name: "Green Bay Packers", div: "NFC North", conf: "NFC" },
  { code: "SEA", name: "Seattle Seahawks", div: "NFC West", conf: "NFC" }
];

const PP_PROB_PATH = [42, 48, 54, 49, 58, 63, 61, 67, 73];

const PP_SCHEDULE = [
  { wk: 1, opp: "@CLE", result: "W", score: "33-17", prob: 62 },
  { wk: 2, opp: "NO", result: "W", score: "44-19", prob: 71 },
  { wk: 3, opp: "@BAL", result: "L", score: "25-28", prob: 39 },
  { wk: 4, opp: "@NYG", result: "W", score: "20-15", prob: 66 },
  { wk: 5, opp: "PIT", result: "W", score: "20-17", prob: 58 },
  { wk: 6, opp: "DET", result: "L", score: "9-47", prob: 44 },
  { wk: 7, opp: "@SF", result: "W", score: "30-24", prob: 43 },
  { wk: 8, opp: "BYE" },
  { wk: 9, opp: "@ATL", result: "W", score: "27-21", prob: 55 },
  { wk: 10, opp: "PHI", prob: 41, mustWin: true },
  { wk: 11, opp: "HOU", prob: 62 },
  { wk: 12, opp: "@WAS", prob: 58 },
  { wk: 13, opp: "NYG", prob: 71 },
  { wk: 14, opp: "@CIN", prob: 49 },
  { wk: 15, opp: "CAR", prob: 74 },
  { wk: 16, opp: "@MIA", prob: 46 },
  { wk: 17, opp: "@PHI", prob: 34, mustWin: true },
  { wk: 18, opp: "WAS", prob: 55 }
];

const PP_PLAYERS = [
  { num: "04", name: "Dak Prescott", pos: "QB", status: "Active", clutch: 88, impact: 21.4 },
  { num: "88", name: "CeeDee Lamb", pos: "WR", status: "Questionable", clutch: 86, impact: 18.7 },
  { num: "11", name: "Micah Parsons", pos: "OLB", status: "Active", clutch: 84, impact: 22.8 },
  { num: "84", name: "Jake Ferguson", pos: "TE", status: "Active", clutch: 76, impact: 10.2 },
  { num: "20", name: "Trevon Diggs", pos: "CB", status: "Active", clutch: 73, impact: 11.4 },
  { num: "23", name: "Rico Dowdle", pos: "RB", status: "Active", clutch: 69, impact: 7.6 }
];

const PP_LEAGUE = [
  ["KC", 92], ["PHI", 88], ["DET", 86], ["BAL", 84], ["BUF", 81], ["SF", 79],
  ["MIN", 76], ["DAL", 73], ["HOU", 71], ["GB", 69], ["LAC", 65], ["CIN", 60],
  ["PIT", 58], ["SEA", 54], ["LAR", 52], ["TB", 49], ["WAS", 41], ["MIA", 35],
  ["NYJ", 31], ["JAX", 28], ["CHI", 24], ["ATL", 21], ["DEN", 19], ["NO", 17]
];

const PP_WIRE = [
  { t: "13m", src: "ESPN", kind: "INJURY", text: "CeeDee Lamb listed Q vs PHI. Full practice expected Wednesday." },
  { t: "1h", src: "QUANTUM", kind: "MODEL", text: "Quantum Engine v4.6 raised DAL playoff probability to 73%." },
  { t: "3h", src: "PFF", kind: "GRADE", text: "Parsons earns 91.4 pass-rush grade vs ATL, a season high." },
  { t: "6h", src: "VEGAS", kind: "MARKET", text: "DAL season win total drifts from 10 to 10.5 across major books." },
  { t: "yest", src: "FILM", kind: "TREND", text: "Third-down conversion rate climbs to 47% over the last three games." }
];

const PP_PATHS = [
  { id: "ALPHA", wins: 13, prob: 18, label: "Run the table", detail: "Win 4 of 5 vs winning teams. NFC #2 seed." },
  { id: "BRAVO", wins: 11, prob: 34, label: "Modal outcome", detail: "Split PHI, beat NYG/CAR/HOU. Wildcard #5." },
  { id: "CHARLIE", wins: 10, prob: 27, label: "Scratch in", detail: "Lose one PHI game, sweep weaker teams. Wildcard #6/#7." },
  { id: "DELTA", wins: 9, prob: 14, label: "Bubble collapse", detail: "Drop both PHI games and lose a tiebreaker." }
];

const PP_TABS = [
  { id: "forecast", label: "Forecast" },
  { id: "engine", label: "Engine" },
  { id: "season", label: "Season" },
  { id: "players", label: "Players" },
  { id: "league", label: "League" },
  { id: "wire", label: "Wire" }
];

const PP_CSS = `
.pp-root{--pp-bg:#06080f;--pp-panel:#0b1020;--pp-panel-2:#10182b;--pp-line:#22304e;--pp-text:#f2f0ea;--pp-muted:#8a95ab;--pp-blue:#4a86ff;--pp-blue-2:#7aa8ff;--pp-gold:#e9b949;--pp-red:#e03a4d;--pp-green:#58d689;min-height:100vh;margin:-1.5rem;background:radial-gradient(circle at 85% 0%,rgba(74,134,255,.18),transparent 34%),radial-gradient(circle at 0% 100%,rgba(233,185,73,.09),transparent 34%),var(--pp-bg);color:var(--pp-text);font-family:'DM Sans',system-ui,sans-serif;overflow:hidden;position:relative}
.pp-root *{box-sizing:border-box}.pp-grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.026) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.026) 1px,transparent 1px);background-size:58px 58px;mask-image:radial-gradient(circle at 55% 12%,#000,transparent 76%);pointer-events:none}.pp-loader{position:absolute;inset:0;z-index:40;background:#06080f;display:grid;place-items:center;animation:pp-loader-out .5s ease 2s forwards}.pp-loader-box{text-align:center;width:min(440px,84vw)}.pp-loader-star{font-size:42px;color:var(--pp-gold);filter:drop-shadow(0 0 24px rgba(233,185,73,.48));animation:pp-spin 3s linear infinite}.pp-loader-title{font-family:'Fraunces',Georgia,serif;font-size:38px;letter-spacing:-.03em;margin-top:18px}.pp-loader-num{font-family:'Fraunces',Georgia,serif;font-weight:800;font-size:88px;line-height:.9;margin:20px 0 10px}.pp-loader-num em{font-size:34px;font-style:italic;color:#d6cdb7}.pp-loader-bar{height:3px;background:#202943;border-radius:99px;overflow:hidden}.pp-loader-fill{height:100%;width:73%;background:linear-gradient(90deg,var(--pp-blue),var(--pp-gold));box-shadow:0 0 22px rgba(233,185,73,.45);animation:pp-fill 1.6s cubic-bezier(.2,.8,.2,1) both}.pp-loader-meta{display:flex;justify-content:space-between;margin-top:10px;font:10px/1 'JetBrains Mono',monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--pp-muted)}
@keyframes pp-loader-out{to{opacity:0;visibility:hidden;pointer-events:none}}@keyframes pp-fill{from{width:0}to{width:73%}}@keyframes pp-spin{to{transform:rotate(360deg)}}
.pp-marquee{position:relative;z-index:2;background:#ede6d6;color:#1a1006;overflow:hidden;border-bottom:1px solid #c8c0ac}.pp-marquee-track{display:flex;gap:54px;width:max-content;white-space:nowrap;padding:8px 0;font:700 12px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;animation:pp-marq 45s linear infinite}@keyframes pp-marq{to{transform:translateX(-50%)}}
.pp-header{position:sticky;top:0;z-index:10;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:14px 24px;background:rgba(6,8,15,.86);backdrop-filter:blur(16px);border-bottom:1px solid var(--pp-line)}.pp-brand{font-family:'Fraunces',Georgia,serif;font-size:22px;font-weight:700;letter-spacing:-.02em}.pp-brand span{color:var(--pp-muted);font-style:italic;font-weight:400}.pp-team-btn{display:flex;align-items:center;gap:12px;border:1px solid var(--pp-line);background:rgba(255,255,255,.04);color:var(--pp-text);border-radius:999px;padding:9px 16px;cursor:pointer}.pp-team-code{font:700 14px/1 'JetBrains Mono',monospace;background:var(--pp-blue);padding:5px 8px;border-radius:6px}.pp-team-name{font:700 11px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase}.pp-team-menu{position:absolute;top:54px;left:50%;transform:translateX(-50%);width:320px;max-height:360px;overflow:auto;border:1px solid var(--pp-line);background:#0b1020;border-radius:12px;padding:6px;box-shadow:0 26px 60px rgba(0,0,0,.55)}.pp-team-row{width:100%;display:grid;grid-template-columns:44px 1fr auto;gap:10px;border:0;background:transparent;color:var(--pp-text);text-align:left;border-radius:8px;padding:10px;cursor:pointer}.pp-team-row:hover,.pp-team-row.is-active{background:rgba(74,134,255,.14)}.pp-team-row-code{font-family:'JetBrains Mono',monospace;color:var(--pp-blue-2)}.pp-team-row-div{font:9px/1 'JetBrains Mono',monospace;color:var(--pp-muted);letter-spacing:.12em;text-transform:uppercase}.pp-clock{justify-self:end;font:700 11px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--pp-green);display:flex;align-items:center;gap:8px}.pp-dot{width:8px;height:8px;border-radius:50%;background:var(--pp-green);box-shadow:0 0 0 0 rgba(88,214,137,.55);animation:pp-pulse 1.6s infinite}@keyframes pp-pulse{to{box-shadow:0 0 0 12px rgba(88,214,137,0)}}
.pp-ticker{position:relative;z-index:2;display:flex;border-bottom:1px solid var(--pp-line);background:rgba(11,16,32,.64)}.pp-ticker-label{flex:0 0 auto;padding:9px 14px;border-right:1px solid var(--pp-line);font:700 10px/1 'JetBrains Mono',monospace;letter-spacing:.22em;color:var(--pp-blue-2)}.pp-ticker-stream{overflow:hidden;flex:1}.pp-ticker-track{display:flex;gap:42px;width:max-content;padding:9px 0;font:11px/1 'JetBrains Mono',monospace;animation:pp-tick 70s linear infinite}.pp-ticker-item b{color:var(--pp-text);margin-left:8px}.pp-up{color:var(--pp-green)}.pp-down{color:var(--pp-red)}@keyframes pp-tick{to{transform:translateX(-50%)}}
.pp-tabs{position:sticky;top:58px;z-index:9;display:flex;overflow:auto;background:rgba(6,8,15,.88);backdrop-filter:blur(16px);border-bottom:1px solid var(--pp-line);padding:0 18px}.pp-tab{position:relative;border:0;background:transparent;color:var(--pp-muted);padding:18px 22px;cursor:pointer;font-family:'Fraunces',Georgia,serif;font-size:18px;font-weight:700}.pp-tab:after{content:"";position:absolute;left:22px;right:22px;bottom:0;height:2px;background:var(--pp-blue);transform:scaleX(0);transition:.25s}.pp-tab.is-active{color:var(--pp-text)}.pp-tab.is-active:after{transform:scaleX(1)}
.pp-main{position:relative;z-index:1;padding:34px 28px 120px;max-width:1280px;margin:0 auto;animation:pp-in .45s ease both}@keyframes pp-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.pp-section{display:flex;align-items:end;justify-content:space-between;gap:20px;border-bottom:1px solid var(--pp-line);padding-bottom:18px;margin:8px 0 24px}.pp-section h2{font-family:'Fraunces',Georgia,serif;font-size:38px;line-height:1;margin:0;letter-spacing:-.03em}.pp-section h2 em{font-weight:400;color:#d6cdb7}.pp-meta{font:10px/1 'JetBrains Mono',monospace;color:var(--pp-muted);letter-spacing:.18em;text-transform:uppercase;text-align:right}
.pp-card{background:linear-gradient(180deg,var(--pp-panel),rgba(6,8,15,.92));border:1px solid var(--pp-line);border-radius:16px;padding:22px;position:relative;overflow:hidden}.pp-card h3{font-family:'Fraunces',Georgia,serif;font-size:22px;margin:0 0 10px}.pp-eyebrow{font:700 10px/1 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--pp-muted)}.pp-hero{display:grid;grid-template-columns:1.45fr 1fr;gap:20px}.pp-headline{font-family:'Fraunces',Georgia,serif;font-size:62px;line-height:.95;letter-spacing:-.045em;margin:20px 0}.pp-headline em{font-weight:400;color:#d6cdb7}.pp-mega{display:flex;align-items:baseline;gap:6px;border-top:1px solid var(--pp-line);border-bottom:1px solid var(--pp-line);padding:18px 0}.pp-mega strong{font-family:'Fraunces',Georgia,serif;font-size:150px;line-height:.82;letter-spacing:-.06em}.pp-mega span{font-family:'Fraunces',Georgia,serif;font-style:italic;font-size:58px;color:#d6cdb7}.pp-delta{display:inline-flex;gap:6px;margin-left:24px;padding:6px 10px;border-radius:999px;background:rgba(88,214,137,.1);border:1px solid rgba(88,214,137,.25);font:700 12px/1 'JetBrains Mono',monospace;color:var(--pp-green)}
.pp-spark{width:100%;height:90px;margin-top:20px}.pp-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.pp-stat{border-top:1px solid var(--pp-line);padding-top:12px}.pp-stat b{display:block;font-family:'Fraunces',Georgia,serif;font-size:34px}.pp-stat span{font:10px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--pp-muted)}.pp-side{display:grid;gap:14px}.pp-table{width:100%;border-collapse:collapse;font-size:13px}.pp-table th{font:10px/1 'JetBrains Mono',monospace;letter-spacing:.18em;color:var(--pp-muted);text-align:left;padding:8px;border-bottom:1px solid var(--pp-line)}.pp-table td{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.06)}.pp-self td{background:rgba(74,134,255,.09);color:var(--pp-text)}
.pp-paths,.pp-league-grid,.pp-rival-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.pp-path,.pp-cell,.pp-player,.pp-game{border:1px solid var(--pp-line);background:rgba(255,255,255,.018);border-radius:12px;padding:16px}.pp-path b,.pp-cell b{font-family:'Fraunces',Georgia,serif;font-size:36px}.pp-path small,.pp-cell small{display:block;color:var(--pp-muted);font:10px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase}.pp-bar{height:5px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden;margin-top:12px}.pp-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--pp-blue),var(--pp-blue-2))}
.pp-games{display:grid;grid-template-columns:repeat(9,1fr);gap:8px}.pp-game{min-height:105px}.pp-game.is-w{border-color:rgba(88,214,137,.35);background:rgba(88,214,137,.06)}.pp-game.is-l{border-color:rgba(224,58,77,.35);background:rgba(224,58,77,.06)}.pp-game.is-mw{border-color:var(--pp-gold);box-shadow:0 0 22px rgba(233,185,73,.08)}.pp-game-code{font-family:'Fraunces',Georgia,serif;font-size:22px}.pp-pill{display:inline-block;margin-top:8px;border-radius:999px;padding:4px 8px;background:rgba(255,255,255,.06);font:9px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--pp-muted)}
.pp-players{display:grid;grid-template-columns:1.2fr 1fr;gap:18px}.pp-player{display:grid;grid-template-columns:42px 1fr auto;gap:12px;align-items:center;margin-bottom:8px}.pp-num{font-family:'Fraunces',Georgia,serif;font-size:24px;color:var(--pp-muted)}.pp-score{font-family:'Fraunces',Georgia,serif;font-size:32px;color:var(--pp-gold)}.pp-wire{display:grid;gap:10px}.pp-wire-row{display:grid;grid-template-columns:58px 90px 1fr;gap:14px;border-bottom:1px solid rgba(255,255,255,.07);padding:14px 0}.pp-src{font:10px/1 'JetBrains Mono',monospace;color:var(--pp-blue-2);letter-spacing:.16em}
.pp-float{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:50;width:min(880px,calc(100vw - 34px));background:rgba(11,16,32,.94);backdrop-filter:blur(18px);border:1px solid var(--pp-line);border-radius:999px;padding:12px 16px;display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;box-shadow:0 30px 70px rgba(0,0,0,.45)}.pp-float b{font-family:'Fraunces',Georgia,serif;font-size:28px}.pp-float button{border:0;border-radius:999px;background:var(--pp-text);color:#06080f;padding:9px 14px;font-weight:800;cursor:pointer}.pp-float.is-open{border-radius:22px;grid-template-columns:1fr 1fr}.pp-controls{display:grid;gap:12px}.pp-controls label{display:flex;justify-content:space-between;font:10px/1 'JetBrains Mono',monospace;color:var(--pp-muted);letter-spacing:.14em;text-transform:uppercase}.pp-controls input{width:100%}.pp-result{border:1px solid var(--pp-line);border-radius:14px;padding:18px;background:linear-gradient(135deg,rgba(74,134,255,.12),rgba(233,185,73,.05))}.pp-result strong{font-family:'Fraunces',Georgia,serif;font-size:70px;line-height:.9}
@media(max-width:900px){.pp-header{grid-template-columns:1fr}.pp-clock{justify-self:start}.pp-hero,.pp-players,.pp-float.is-open{grid-template-columns:1fr}.pp-games{grid-template-columns:repeat(3,1fr)}.pp-paths,.pp-league-grid,.pp-rival-grid,.pp-stat-grid{grid-template-columns:1fr 1fr}.pp-headline{font-size:44px}.pp-mega strong{font-size:108px}.pp-tabs{top:0}.pp-root{margin:-1rem}}
`;

function PPStar() {
  return <span aria-hidden="true">★</span>;
}

function PPSparkline({ data }) {
  const w = 700;
  const h = 90;
  const min = Math.min(...data) - 4;
  const max = Math.max(...data) + 4;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="pp-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="rgba(74,134,255,.18)" />
      <polyline points={pts} fill="none" stroke="var(--pp-blue-2)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PPLoader() {
  return (
    <div className="pp-loader">
      <div className="pp-loader-box">
        <div className="pp-loader-star"><PPStar /></div>
        <div className="pp-loader-title">Playoff Pulse</div>
        <div className="pp-loader-num">73<em>%</em></div>
        <div className="pp-loader-bar"><div className="pp-loader-fill" /></div>
        <div className="pp-loader-meta"><span>Quantum Engine v4.6</span><span>Ready</span></div>
      </div>
    </div>
  );
}

function PPHeader({ team, setTeam, open, setOpen, now }) {
  const active = PP_TEAMS.find((item) => item.code === team) || PP_TEAMS[0];
  return (
    <header className="pp-header">
      <div className="pp-brand">Playoff <span>Pulse</span></div>
      <div style={{ position: "relative" }}>
        <button className="pp-team-btn" onClick={() => setOpen(!open)}>
          <span className="pp-team-code">{active.code}</span>
          <span className="pp-team-name">{active.name}</span>
          <span>▾</span>
        </button>
        {open && (
          <div className="pp-team-menu" onMouseLeave={() => setOpen(false)}>
            {PP_TEAMS.map((item) => (
              <button
                key={item.code}
                className={`pp-team-row${item.code === team ? " is-active" : ""}`}
                onClick={() => {
                  setTeam(item.code);
                  setOpen(false);
                }}
              >
                <span className="pp-team-row-code">{item.code}</span>
                <span>{item.name}</span>
                <span className="pp-team-row-div">{item.div}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pp-clock"><span className="pp-dot" /> LIVE · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    </header>
  );
}

function PPTicker({ now, dalProbability = 73, topTeam = ["KC", 92] }) {
  const items = [
    ["DAL Playoff", `${dalProbability}%`, "up"],
    ["Δ Wk/Wk", "+6 pts", "up"],
    ["Proj Wins", "11.2", "up"],
    ["Top Odds", `${topTeam[0]} · ${topTeam[1]}%`, "flat"],
    ["DAL Rank", "#8 of 32", "up"],
    ["Bubble Watch", "SEA · LAR · TB", "down"],
    ["TSI", "12.4 · #7", "up"],
    ["Next Game", "WK 10 PHI", "flat"],
    ["ET", now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), "flat"]
  ];
  return (
    <div className="pp-ticker">
      <div className="pp-ticker-label">LIVE INTEL</div>
      <div className="pp-ticker-stream">
        <div className="pp-ticker-track">
          {[...items, ...items, ...items].map(([label, value, trend], i) => (
            <span key={i} className="pp-ticker-item">
              {label}<b>{value}</b>{trend === "up" && <span className="pp-up">▲</span>}{trend === "down" && <span className="pp-down">▼</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PPTabBar({ tab, setTab }) {
  return (
    <nav className="pp-tabs">
      {PP_TABS.map((item, index) => (
        <button key={item.id} className={`pp-tab${tab === item.id ? " is-active" : ""}`} onClick={() => setTab(item.id)}>
          0{index + 1} · {item.label}
        </button>
      ))}
    </nav>
  );
}

function PPSection({ title, em, meta }) {
  return (
    <div className="pp-section">
      <h2>{title} <em>{em}</em></h2>
      <div className="pp-meta">{meta}</div>
    </div>
  );
}

function PPForecast({ dalProbability = 73, backendStatus = "mock model" }) {
  return (
    <main className="pp-main">
      <PPSection title="Forecast" em="from the Quantum Engine" meta={`MODEL v4.6 · ${backendStatus.toUpperCase()}`} />
      <section className="pp-hero">
        <article className="pp-card">
          <div className="pp-eyebrow"><PPStar /> Dallas Cowboys · NFC East</div>
          <h1 className="pp-headline">The Cowboys are <em>trending</em><br />into the bracket.</h1>
          <div className="pp-mega">
            <strong>{dalProbability}</strong><span>%</span>
            <div className="pp-delta">▲ +6 pts</div>
          </div>
          <PPSparkline data={PP_PROB_PATH} />
          <div className="pp-stat-grid">
            <div className="pp-stat"><b>11.2</b><span>Projected wins</span></div>
            <div className="pp-stat"><b>.608</b><span>Strength of schedule</span></div>
            <div className="pp-stat"><b style={{ color: "var(--pp-green)" }}>+32</b><span>Point diff</span></div>
            <div className="pp-stat"><b>0.81</b><span>Model confidence</span></div>
          </div>
        </article>
        <div className="pp-side">
          <article className="pp-card">
            <div className="pp-eyebrow">Record</div>
            <h3>7 wins · 2 losses</h3>
            <table className="pp-table">
              <tbody>
                {[
                  ["PF", "230"], ["PA", "198"], ["DIFF", "+32"], ["STREAK", "W3"]
                ].map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}
              </tbody>
            </table>
          </article>
          <article className="pp-card">
            <div className="pp-eyebrow">NFC East</div>
            <h3>Standings pressure</h3>
            <table className="pp-table">
              <tbody>
                {[
                  ["PHI", "7-2", ".778"], ["DAL", "7-2", ".778"], ["WAS", "4-5", ".444"], ["NYG", "2-7", ".222"]
                ].map((row) => <tr key={row[0]} className={row[0] === "DAL" ? "pp-self" : ""}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}
              </tbody>
            </table>
          </article>
        </div>
      </section>
    </main>
  );
}

function PPEngine() {
  return (
    <main className="pp-main">
      <PPSection title="Quantum" em="engine" meta="20,000 MONTE CARLO RUNS" />
      <div className="pp-paths">
        {PP_PATHS.map((path) => (
          <article className="pp-path" key={path.id}>
            <small>{path.id}</small>
            <b>{path.wins}<span style={{ fontSize: 17, color: "var(--pp-muted)" }}> wins</span></b>
            <h3>{path.label}</h3>
            <p style={{ color: "var(--pp-muted)", lineHeight: 1.45 }}>{path.detail}</p>
            <small>{path.prob}% likely</small>
            <div className="pp-bar"><div className="pp-fill" style={{ width: `${path.prob * 2.4}%` }} /></div>
          </article>
        ))}
      </div>
    </main>
  );
}

function PPSeason() {
  return (
    <main className="pp-main">
      <PPSection title="Season" em="map" meta="17 GAMES · MUST-WIN FLAGS" />
      <div className="pp-games">
        {PP_SCHEDULE.map((game) => (
          <article key={game.wk} className={`pp-game ${game.result === "W" ? "is-w" : ""} ${game.result === "L" ? "is-l" : ""} ${game.mustWin ? "is-mw" : ""}`}>
            <div className="pp-eyebrow">WK {game.wk}</div>
            <div className="pp-game-code">{game.opp}</div>
            {game.result ? <div className="pp-score">{game.result}</div> : <div className="pp-score" style={{ color: "var(--pp-blue-2)" }}>{game.prob ? `${game.prob}%` : "BYE"}</div>}
            {game.score && <div style={{ color: "var(--pp-muted)" }}>{game.score}</div>}
            {game.mustWin && <span className="pp-pill" style={{ color: "var(--pp-gold)" }}>must-win</span>}
          </article>
        ))}
      </div>
    </main>
  );
}

function PPPlayers() {
  return (
    <main className="pp-main">
      <PPSection title="Player" em="lab" meta="ROSTER · CLUTCH · IMPACT" />
      <div className="pp-players">
        <article className="pp-card">
          <h3>Top role-impact players</h3>
          {PP_PLAYERS.map((player) => (
            <div className="pp-player" key={player.num}>
              <div className="pp-num">#{player.num}</div>
              <div><b>{player.name}</b><div className="pp-eyebrow">{player.pos} · {player.status}</div></div>
              <div className="pp-score">{player.impact.toFixed(1)}</div>
            </div>
          ))}
        </article>
        <article className="pp-card">
          <h3>Clutch Index</h3>
          {PP_PLAYERS.slice(0, 5).map((player) => (
            <div className="pp-player" key={player.name}>
              <div className="pp-num">{player.pos}</div>
              <div><b>{player.name}</b><div className="pp-eyebrow">late-game pressure</div></div>
              <div className="pp-score">{player.clutch}</div>
            </div>
          ))}
        </article>
      </div>
    </main>
  );
}

function PPLeague({ leagueData = PP_LEAGUE }) {
  return (
    <main className="pp-main">
      <PPSection title="League" em="pulse" meta={`${leagueData.length} TEAMS · BACKEND PLAYOFF PROBABILITY`} />
      <div className="pp-league-grid">
        {leagueData.map(([code, probability]) => (
          <article key={code} className="pp-cell" style={code === "DAL" ? { borderColor: "rgba(74,134,255,.65)", background: "rgba(74,134,255,.08)" } : null}>
            <small>{code}</small>
            <b style={{ color: probability >= 70 ? "var(--pp-green)" : probability >= 45 ? "var(--pp-blue-2)" : "var(--pp-gold)" }}>{probability}%</b>
            <div className="pp-bar"><div className="pp-fill" style={{ width: `${probability}%` }} /></div>
          </article>
        ))}
      </div>
    </main>
  );
}

function PPWire() {
  return (
    <main className="pp-main">
      <PPSection title="Live" em="wire" meta="ESPN · PFF · QUANTUM · VEGAS" />
      <article className="pp-card">
        <h3>Newsroom feed</h3>
        <div className="pp-wire">
          {PP_WIRE.map((item, index) => (
            <div className="pp-wire-row" key={index}>
              <div className="pp-eyebrow">{item.t}</div>
              <div><div className="pp-src">{item.src}</div><div className="pp-eyebrow">{item.kind}</div></div>
              <div>{item.text}</div>
            </div>
          ))}
        </div>
      </article>
    </main>
  );
}

function PPFloatingWinProb() {
  const [open, setOpen] = useState(false);
  const [margin, setMargin] = useState(3);
  const [time, setTime] = useState(720);
  const [yard, setYard] = useState(50);
  const winProb = useMemo(() => {
    const timeWeight = 1 + (1 - time / 3600) * 4;
    const z = margin * .18 * timeWeight + (yard - 50) / 100;
    return Math.round((1 / (1 + Math.exp(-z))) * 1000) / 10;
  }, [margin, time, yard]);
  return (
    <div className={`pp-float${open ? " is-open" : ""}`}>
      {!open ? (
        <>
          <div><div className="pp-eyebrow">Live Win Probability</div><b>{winProb.toFixed(1)}%</b></div>
          <div className="pp-eyebrow">DAL {margin >= 0 ? "+" : ""}{margin} · {Math.floor(time / 60)}:{String(time % 60).padStart(2, "0")} left · YL {yard}</div>
          <button onClick={() => setOpen(true)}>What-if</button>
        </>
      ) : (
        <>
          <div className="pp-controls">
            <label>Score margin <strong>{margin >= 0 ? "+" : ""}{margin}</strong></label>
            <input type="range" min="-21" max="21" value={margin} onChange={(event) => setMargin(Number(event.target.value))} />
            <label>Time remaining <strong>{Math.floor(time / 60)}:{String(time % 60).padStart(2, "0")}</strong></label>
            <input type="range" min="0" max="3600" step="30" value={time} onChange={(event) => setTime(Number(event.target.value))} />
            <label>Yard line <strong>{yard}</strong></label>
            <input type="range" min="1" max="99" value={yard} onChange={(event) => setYard(Number(event.target.value))} />
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="pp-result"><div className="pp-eyebrow">DAL win probability</div><strong>{winProb.toFixed(1)}%</strong><div className="pp-bar"><div className="pp-fill" style={{ width: `${winProb}%` }} /></div></div>
        </>
      )}
    </div>
  );
}

function PlayoffPulsePage({ year = new Date().getFullYear() }) {
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState("DAL");
  const [teamOpen, setTeamOpen] = useState(false);
  const [tab, setTab] = useState("forecast");
  const [now, setNow] = useState(new Date());
  const [pulse, setPulse] = useState([]);
  const [backendError, setBackendError] = useState("");

  const leagueData = useMemo(() => {
    if (!Array.isArray(pulse) || pulse.length === 0) return PP_LEAGUE;
    return pulse
      .map((item) => [
        item.code || item.team || item.teamCode,
        Math.round(Number(item.playoffProbability || item.playoff_probability || 0))
      ])
      .filter(([code]) => Boolean(code))
      .sort((a, b) => b[1] - a[1]);
  }, [pulse]);

  const dalProbability = useMemo(() => {
    const dal = leagueData.find(([code]) => code === "DAL");
    return dal ? dal[1] : 73;
  }, [leagueData]);

  const topTeam = leagueData[0] || ["KC", 92];
  const backendStatus = backendError ? "offline fallback" : pulse.length ? "backend live" : "loading backend";

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setBackendError("");
    if (!window.api || typeof window.api.getPlayoffPulse !== "function") {
      setBackendError("Backend API client unavailable.");
      return () => { active = false; };
    }
    window.api
      .getPlayoffPulse(year)
      .then((data) => {
        if (!active) return;
        if (!data || !Array.isArray(data.pulse)) throw new Error("No playoff pulse data returned.");
        setPulse(data.pulse);
      })
      .catch((error) => {
        if (!active) return;
        setBackendError(error?.message || "Unable to load backend playoff pulse.");
      });
    return () => { active = false; };
  }, [year]);

  useEffect(() => {
    const onKey = (event) => {
      const index = Number(event.key);
      if (index >= 1 && index <= PP_TABS.length) setTab(PP_TABS[index - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pp-root">
      <style>{PP_CSS}</style>
      <div className="pp-grid" />
      {loading && <PPLoader />}
      <div className="pp-marquee"><div className="pp-marquee-track">{[1,2].map((group) => <React.Fragment key={group}><span>★ America's Team · Week 9 Intel</span><span>★ Playoff Probability · 73%</span><span>★ Projected Wins · 11.2</span><span>★ Quantum Engine v4.6 · Live</span></React.Fragment>)}</div></div>
      <PPHeader team={team} setTeam={setTeam} open={teamOpen} setOpen={setTeamOpen} now={now} />
      <PPTicker now={now} dalProbability={dalProbability} topTeam={topTeam} />
      <PPTabBar tab={tab} setTab={setTab} />
      {tab === "forecast" && <PPForecast dalProbability={dalProbability} backendStatus={backendStatus} />}
      {tab === "engine" && <PPEngine />}
      {tab === "season" && <PPSeason />}
      {tab === "players" && <PPPlayers />}
      {tab === "league" && <PPLeague leagueData={leagueData} />}
      {tab === "wire" && <PPWire />}
      <PPFloatingWinProb />
    </div>
  );
}

window.PlayoffPulsePage = PlayoffPulsePage;
