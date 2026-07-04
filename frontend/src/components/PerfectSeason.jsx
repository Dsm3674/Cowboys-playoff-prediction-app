import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

/*
 * Perfect Season — the War Room's second game mode, inspired by 82-0.com.
 * Spin the wheel for a legendary NFL team-era, draft an all-time roster
 * from each pool, then play a 20-game season one reveal at a time chasing
 * 20-0. Wins pay out Star Coins into the same wallet as the markets.
 */

const ERAS = [
  {
    name: "'70s Steelers",
    players: [
      { name: "Terry Bradshaw", pos: "QB", rating: 89 },
      { name: "Franco Harris", pos: "RB", rating: 91 },
      { name: "Lynn Swann", pos: "WR", rating: 88 },
      { name: "John Stallworth", pos: "WR", rating: 89 },
      { name: "Bennie Cunningham", pos: "TE", rating: 82 },
      { name: "Mike Webster", pos: "OL", rating: 95 },
      { name: "Joe Greene", pos: "DL", rating: 97 },
      { name: "Jack Lambert", pos: "LB", rating: 95 },
      { name: "Jack Ham", pos: "LB", rating: 94 },
      { name: "Mel Blount", pos: "DB", rating: 94 },
      { name: "Donnie Shell", pos: "DB", rating: 88 }
    ]
  },
  {
    name: "'70s Doomsday Cowboys",
    players: [
      { name: "Roger Staubach", pos: "QB", rating: 94 },
      { name: "Tony Dorsett", pos: "RB", rating: 93 },
      { name: "Drew Pearson", pos: "WR", rating: 90 },
      { name: "Billy Joe DuPree", pos: "TE", rating: 86 },
      { name: "Rayfield Wright", pos: "OL", rating: 92 },
      { name: "Bob Lilly", pos: "DL", rating: 96 },
      { name: "Randy White", pos: "DL", rating: 95 },
      { name: "Chuck Howley", pos: "LB", rating: 93 },
      { name: "Cliff Harris", pos: "DB", rating: 91 },
      { name: "Mel Renfro", pos: "DB", rating: 93 }
    ]
  },
  {
    name: "'80s 49ers",
    players: [
      { name: "Joe Montana", pos: "QB", rating: 97 },
      { name: "Roger Craig", pos: "RB", rating: 90 },
      { name: "Jerry Rice", pos: "WR", rating: 99 },
      { name: "Dwight Clark", pos: "WR", rating: 87 },
      { name: "Brent Jones", pos: "TE", rating: 85 },
      { name: "Randy Cross", pos: "OL", rating: 88 },
      { name: "Jesse Sapolu", pos: "OL", rating: 84 },
      { name: "Fred Dean", pos: "DL", rating: 89 },
      { name: "Charles Haley", pos: "LB", rating: 91 },
      { name: "Ronnie Lott", pos: "DB", rating: 97 },
      { name: "Eric Wright", pos: "DB", rating: 86 }
    ]
  },
  {
    name: "'85 Bears",
    players: [
      { name: "Jim McMahon", pos: "QB", rating: 84 },
      { name: "Walter Payton", pos: "RB", rating: 98 },
      { name: "Willie Gault", pos: "WR", rating: 85 },
      { name: "Emery Moorehead", pos: "TE", rating: 80 },
      { name: "Jimbo Covert", pos: "OL", rating: 91 },
      { name: "Richard Dent", pos: "DL", rating: 93 },
      { name: "Dan Hampton", pos: "DL", rating: 92 },
      { name: "Mike Singletary", pos: "LB", rating: 95 },
      { name: "Otis Wilson", pos: "LB", rating: 87 },
      { name: "Dave Duerson", pos: "DB", rating: 86 },
      { name: "Gary Fencik", pos: "DB", rating: 85 }
    ]
  },
  {
    name: "'86 Giants",
    players: [
      { name: "Phil Simms", pos: "QB", rating: 86 },
      { name: "Joe Morris", pos: "RB", rating: 85 },
      { name: "Lionel Manuel", pos: "WR", rating: 80 },
      { name: "Mark Bavaro", pos: "TE", rating: 90 },
      { name: "Brad Benson", pos: "OL", rating: 82 },
      { name: "Leonard Marshall", pos: "DL", rating: 87 },
      { name: "Lawrence Taylor", pos: "LB", rating: 99 },
      { name: "Harry Carson", pos: "LB", rating: 90 },
      { name: "Carl Banks", pos: "LB", rating: 88 },
      { name: "Mark Collins", pos: "DB", rating: 84 }
    ]
  },
  {
    name: "'90s Cowboys Dynasty",
    players: [
      { name: "Troy Aikman", pos: "QB", rating: 93 },
      { name: "Emmitt Smith", pos: "RB", rating: 97 },
      { name: "Michael Irvin", pos: "WR", rating: 94 },
      { name: "Jay Novacek", pos: "TE", rating: 87 },
      { name: "Larry Allen", pos: "OL", rating: 98 },
      { name: "Erik Williams", pos: "OL", rating: 90 },
      { name: "Charles Haley", pos: "DL", rating: 92 },
      { name: "Ken Norton Jr.", pos: "LB", rating: 88 },
      { name: "Deion Sanders", pos: "DB", rating: 98 },
      { name: "Darren Woodson", pos: "DB", rating: 92 }
    ]
  },
  {
    name: "'90s Packers",
    players: [
      { name: "Brett Favre", pos: "QB", rating: 94 },
      { name: "Dorsey Levens", pos: "RB", rating: 84 },
      { name: "Antonio Freeman", pos: "WR", rating: 86 },
      { name: "Robert Brooks", pos: "WR", rating: 84 },
      { name: "Mark Chmura", pos: "TE", rating: 84 },
      { name: "Frank Winters", pos: "OL", rating: 84 },
      { name: "Reggie White", pos: "DL", rating: 98 },
      { name: "Santana Dotson", pos: "DL", rating: 84 },
      { name: "Wayne Simmons", pos: "LB", rating: 82 },
      { name: "LeRoy Butler", pos: "DB", rating: 91 }
    ]
  },
  {
    name: "'90s Lions",
    players: [
      { name: "Scott Mitchell", pos: "QB", rating: 78 },
      { name: "Barry Sanders", pos: "RB", rating: 99 },
      { name: "Herman Moore", pos: "WR", rating: 89 },
      { name: "Brett Perriman", pos: "WR", rating: 83 },
      { name: "David Sloan", pos: "TE", rating: 78 },
      { name: "Lomas Brown", pos: "OL", rating: 89 },
      { name: "Robert Porcher", pos: "DL", rating: 85 },
      { name: "Chris Spielman", pos: "LB", rating: 87 },
      { name: "Bennie Blades", pos: "DB", rating: 83 }
    ]
  },
  {
    name: "'99 Rams (Greatest Show)",
    players: [
      { name: "Kurt Warner", pos: "QB", rating: 92 },
      { name: "Marshall Faulk", pos: "RB", rating: 96 },
      { name: "Isaac Bruce", pos: "WR", rating: 92 },
      { name: "Torry Holt", pos: "WR", rating: 91 },
      { name: "Roland Williams", pos: "TE", rating: 80 },
      { name: "Orlando Pace", pos: "OL", rating: 96 },
      { name: "Kevin Carter", pos: "DL", rating: 90 },
      { name: "D'Marco Farr", pos: "DL", rating: 84 },
      { name: "London Fletcher", pos: "LB", rating: 88 },
      { name: "Todd Lyght", pos: "DB", rating: 85 }
    ]
  },
  {
    name: "'00 Ravens Defense",
    players: [
      { name: "Trent Dilfer", pos: "QB", rating: 78 },
      { name: "Jamal Lewis", pos: "RB", rating: 89 },
      { name: "Qadry Ismail", pos: "WR", rating: 81 },
      { name: "Shannon Sharpe", pos: "TE", rating: 92 },
      { name: "Jonathan Ogden", pos: "OL", rating: 97 },
      { name: "Sam Adams", pos: "DL", rating: 87 },
      { name: "Tony Siragusa", pos: "DL", rating: 84 },
      { name: "Ray Lewis", pos: "LB", rating: 99 },
      { name: "Peter Boulware", pos: "LB", rating: 87 },
      { name: "Rod Woodson", pos: "DB", rating: 94 },
      { name: "Chris McAlister", pos: "DB", rating: 88 }
    ]
  },
  {
    name: "'00s Patriots",
    players: [
      { name: "Tom Brady", pos: "QB", rating: 99 },
      { name: "Corey Dillon", pos: "RB", rating: 88 },
      { name: "Randy Moss", pos: "WR", rating: 97 },
      { name: "Troy Brown", pos: "WR", rating: 85 },
      { name: "Ben Watson", pos: "TE", rating: 82 },
      { name: "Matt Light", pos: "OL", rating: 86 },
      { name: "Richard Seymour", pos: "DL", rating: 93 },
      { name: "Vince Wilfork", pos: "DL", rating: 90 },
      { name: "Tedy Bruschi", pos: "LB", rating: 88 },
      { name: "Ty Law", pos: "DB", rating: 92 },
      { name: "Rodney Harrison", pos: "DB", rating: 90 }
    ]
  },
  {
    name: "'00s Colts",
    players: [
      { name: "Peyton Manning", pos: "QB", rating: 98 },
      { name: "Edgerrin James", pos: "RB", rating: 92 },
      { name: "Marvin Harrison", pos: "WR", rating: 96 },
      { name: "Reggie Wayne", pos: "WR", rating: 92 },
      { name: "Dallas Clark", pos: "TE", rating: 88 },
      { name: "Jeff Saturday", pos: "OL", rating: 90 },
      { name: "Dwight Freeney", pos: "DL", rating: 93 },
      { name: "Robert Mathis", pos: "DL", rating: 90 },
      { name: "Gary Brackett", pos: "LB", rating: 82 },
      { name: "Bob Sanders", pos: "DB", rating: 89 }
    ]
  },
  {
    name: "'00s Cowboys Grit",
    players: [
      { name: "Tony Romo", pos: "QB", rating: 89 },
      { name: "Marion Barber", pos: "RB", rating: 84 },
      { name: "Terrell Owens", pos: "WR", rating: 93 },
      { name: "Jason Witten", pos: "TE", rating: 93 },
      { name: "Flozell Adams", pos: "OL", rating: 87 },
      { name: "La'Roi Glover", pos: "DL", rating: 88 },
      { name: "DeMarcus Ware", pos: "LB", rating: 96 },
      { name: "Terence Newman", pos: "DB", rating: 86 },
      { name: "Roy Williams", pos: "DB", rating: 87 }
    ]
  },
  {
    name: "'10s Seahawks (LOB)",
    players: [
      { name: "Russell Wilson", pos: "QB", rating: 90 },
      { name: "Marshawn Lynch", pos: "RB", rating: 93 },
      { name: "Doug Baldwin", pos: "WR", rating: 87 },
      { name: "Zach Miller", pos: "TE", rating: 83 },
      { name: "Max Unger", pos: "OL", rating: 88 },
      { name: "Michael Bennett", pos: "DL", rating: 88 },
      { name: "Cliff Avril", pos: "DL", rating: 86 },
      { name: "Bobby Wagner", pos: "LB", rating: 95 },
      { name: "Richard Sherman", pos: "DB", rating: 94 },
      { name: "Earl Thomas", pos: "DB", rating: 95 },
      { name: "Kam Chancellor", pos: "DB", rating: 91 }
    ]
  },
  {
    name: "'10s Patriots",
    players: [
      { name: "Tom Brady", pos: "QB", rating: 98 },
      { name: "LeGarrette Blount", pos: "RB", rating: 84 },
      { name: "Julian Edelman", pos: "WR", rating: 87 },
      { name: "Rob Gronkowski", pos: "TE", rating: 97 },
      { name: "Nate Solder", pos: "OL", rating: 85 },
      { name: "Chandler Jones", pos: "DL", rating: 89 },
      { name: "Dont'a Hightower", pos: "LB", rating: 88 },
      { name: "Devin McCourty", pos: "DB", rating: 89 },
      { name: "Stephon Gilmore", pos: "DB", rating: 93 }
    ]
  },
  {
    name: "'10s Cowboys",
    players: [
      { name: "Dak Prescott", pos: "QB", rating: 88 },
      { name: "Ezekiel Elliott", pos: "RB", rating: 92 },
      { name: "Dez Bryant", pos: "WR", rating: 91 },
      { name: "Jason Witten", pos: "TE", rating: 89 },
      { name: "Tyron Smith", pos: "OL", rating: 95 },
      { name: "Zack Martin", pos: "OL", rating: 96 },
      { name: "Travis Frederick", pos: "OL", rating: 93 },
      { name: "DeMarcus Lawrence", pos: "DL", rating: 89 },
      { name: "Sean Lee", pos: "LB", rating: 90 },
      { name: "Byron Jones", pos: "DB", rating: 87 }
    ]
  },
  {
    name: "'20s Chiefs",
    players: [
      { name: "Patrick Mahomes", pos: "QB", rating: 99 },
      { name: "Isiah Pacheco", pos: "RB", rating: 84 },
      { name: "Tyreek Hill", pos: "WR", rating: 96 },
      { name: "Travis Kelce", pos: "TE", rating: 98 },
      { name: "Creed Humphrey", pos: "OL", rating: 92 },
      { name: "Chris Jones", pos: "DL", rating: 95 },
      { name: "Frank Clark", pos: "DL", rating: 85 },
      { name: "Nick Bolton", pos: "LB", rating: 87 },
      { name: "Trent McDuffie", pos: "DB", rating: 89 },
      { name: "Justin Reid", pos: "DB", rating: 84 }
    ]
  },
  {
    name: "'20s 49ers",
    players: [
      { name: "Brock Purdy", pos: "QB", rating: 86 },
      { name: "Christian McCaffrey", pos: "RB", rating: 96 },
      { name: "Deebo Samuel", pos: "WR", rating: 89 },
      { name: "Brandon Aiyuk", pos: "WR", rating: 87 },
      { name: "George Kittle", pos: "TE", rating: 95 },
      { name: "Trent Williams", pos: "OL", rating: 97 },
      { name: "Nick Bosa", pos: "DL", rating: 95 },
      { name: "Fred Warner", pos: "LB", rating: 96 },
      { name: "Charvarius Ward", pos: "DB", rating: 88 },
      { name: "Talanoa Hufanga", pos: "DB", rating: 85 }
    ]
  },
  {
    name: "'20s Cowboys Stars",
    players: [
      { name: "Dak Prescott", pos: "QB", rating: 90 },
      { name: "Tony Pollard", pos: "RB", rating: 86 },
      { name: "CeeDee Lamb", pos: "WR", rating: 94 },
      { name: "Jake Ferguson", pos: "TE", rating: 84 },
      { name: "Zack Martin", pos: "OL", rating: 94 },
      { name: "Osa Odighizuwa", pos: "DL", rating: 85 },
      { name: "Micah Parsons", pos: "LB", rating: 97 },
      { name: "Trevon Diggs", pos: "DB", rating: 90 },
      { name: "DaRon Bland", pos: "DB", rating: 89 }
    ]
  }
];

const SLOTS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB"];

const OPPONENTS = [
  { name: "'03 Panthers", rating: 87 },
  { name: "'11 Giants", rating: 88 },
  { name: "'17 Eagles", rating: 90 },
  { name: "'92 Redskins", rating: 90 },
  { name: "'21 Rams", rating: 90 },
  { name: "'12 Broncos", rating: 90 },
  { name: "'15 Panthers", rating: 91 },
  { name: "'06 Colts", rating: 91 },
  { name: "'08 Steelers", rating: 91 },
  { name: "'86 Giants", rating: 92 },
  { name: "'19 Ravens", rating: 92 },
  { name: "'23 49ers", rating: 92 },
  { name: "'96 Packers", rating: 93 },
  { name: "'98 Broncos", rating: 93 },
  { name: "'99 Rams", rating: 93 },
  { name: "'13 Seahawks", rating: 94 },
  { name: "'00 Ravens", rating: 94 },
  { name: "'20 Chiefs", rating: 94 },
  { name: "'75 Steelers", rating: 95 },
  { name: "'89 49ers", rating: 95 },
  { name: "'07 Patriots", rating: 96 },
  { name: "'85 Bears", rating: 97 }
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSchedule() {
  // 17 regular-season games easiest-to-hardest-ish, then 3 playoff monsters.
  const pool = shuffle(OPPONENTS);
  const regular = pool.slice(0, 17).sort((x, y) => x.rating - y.rating);
  const playoffs = shuffle(OPPONENTS.filter((o) => o.rating >= 94)).slice(0, 3);
  return regular.concat(playoffs).map((o, i) => ({
    ...o,
    week: i + 1,
    playoff: i >= 17
  }));
}

function rollPool(era, roster) {
  const openSlots = new Set(SLOTS.filter((s) => !roster[s]));
  const pool = shuffle(era.players).slice(0, 7);
  // Guarantee at least one pickable card so the draft can't dead-end —
  // rescue from this era first, then from anywhere in the league.
  if (!pool.some((p) => openSlots.has(p.pos))) {
    const rescue =
      era.players.find((p) => openSlots.has(p.pos)) ||
      shuffle(ERAS.flatMap((e) => e.players)).find((p) => openSlots.has(p.pos));
    if (rescue) pool[0] = rescue;
  }
  return pool;
}

function teamRating(roster) {
  const picks = SLOTS.map((s) => roster[s]).filter(Boolean);
  if (!picks.length) return 0;
  return picks.reduce((sum, p) => sum + p.rating, 0) / picks.length;
}

function winProbability(team, opp) {
  return 1 / (1 + Math.pow(10, (opp - (team + 1.5)) / 10));
}

export default function PerfectSeason({ onReward }) {
  const [phase, setPhase] = useState("idle"); // idle | spin | draft | ready | season | done
  const [era, setEra] = useState(null);
  const [spinName, setSpinName] = useState(ERAS[0].name);
  const [roster, setRoster] = useState({});
  const [pool, setPool] = useState([]);
  const [skips, setSkips] = useState(3);
  const [schedule, setSchedule] = useState([]);
  const [gameIndex, setGameIndex] = useState(0);
  const [results, setResults] = useState([]); // "W" | "L"
  const [stamp, setStamp] = useState(null); // result of the game on screen
  const [reward, setReward] = useState(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  const rosterFull = SLOTS.every((s) => roster[s]);
  const wins = results.filter((r) => r === "W").length;
  const losses = results.filter((r) => r === "L").length;

  function spinWheel(nextRoster) {
    setPhase("spin");
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      setSpinName(ERAS[Math.floor(Math.random() * ERAS.length)].name);
      if (ticks >= 12) {
        clearInterval(interval);
        const landed = ERAS[Math.floor(Math.random() * ERAS.length)];
        setEra(landed);
        setSpinName(landed.name);
        later(() => {
          setPool(rollPool(landed, nextRoster));
          setPhase("draft");
        }, 350);
      }
    }, 90);
    timers.current.push(interval);
  }

  function startDraft() {
    setRoster({});
    setResults([]);
    setGameIndex(0);
    setStamp(null);
    setReward(null);
    setSkips(3);
    spinWheel({});
  }

  function pick(player) {
    if (roster[player.pos]) return;
    const next = { ...roster, [player.pos]: player };
    setRoster(next);
    if (SLOTS.every((s) => next[s])) {
      setPhase("ready");
    } else {
      spinWheel(next);
    }
  }

  function skip() {
    if (skips < 1 || !era) return;
    setSkips(skips - 1);
    spinWheel(roster);
  }

  function playSeason() {
    const sched = buildSchedule();
    setSchedule(sched);
    setResults([]);
    setGameIndex(0);
    setStamp(null);
    setPhase("season");
    playGame(sched, 0, [], teamRating(roster));
  }

  function playGame(sched, index, resultsSoFar, rating) {
    setGameIndex(index);
    setStamp(null);
    later(() => {
      const won = Math.random() < winProbability(rating, sched[index].rating);
      const outcome = won ? "W" : "L";
      const nextResults = [...resultsSoFar, outcome];
      setStamp(outcome);
      setResults(nextResults);
      later(() => {
        if (!won || index + 1 >= sched.length) {
          setPhase("done");
        } else {
          playGame(sched, index + 1, nextResults, rating);
        }
      }, 1250);
    }, 950);
  }

  // Claim Star Coins once when the season ends.
  useEffect(() => {
    if (phase !== "done" || reward !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.claimSeasonReward(wins);
        if (!cancelled) {
          setReward(data);
          if (onReward && data && typeof data.balance === "number") {
            onReward(data.balance);
          }
        }
      } catch (_err) {
        if (!cancelled) setReward({ ok: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const perfect = phase === "done" && wins === schedule.length && losses === 0;
  const currentGame = schedule[gameIndex];

  return (
    <div className="ps">
      {phase === "idle" ? (
        <div className="ps-splash ps-pop">
          <div className="ps-kicker">Game mode</div>
          <h2 className="ps-headline">
            Can you go <span className="ps-score">20–0</span>?
          </h2>
          <p className="ps-copy">
            Spin the wheel for a legendary NFL team-era — the '70s Steelers,
            the '85 Bears, the '00s Patriots, the Doomsday Cowboys. Draft an
            all-time roster, one pool at a time. Then survive twenty of the
            greatest teams ever assembled — lose once and the season is over.
            Every win pays Star Coins.
          </p>
          <button className="wr-btn ps-cta" onClick={startDraft}>
            Spin the wheel
          </button>
        </div>
      ) : null}

      {phase === "spin" ? (
        <div className="ps-spin ps-pop">
          <div className="ps-kicker">Scouting era…</div>
          <div className="ps-slot" aria-live="polite">
            <span className="ps-slot__name">{spinName}</span>
          </div>
        </div>
      ) : null}

      {phase === "draft" || phase === "ready" ? (
        <div className="ps-draft ps-pop">
          <div className="ps-draft__head">
            <div>
              <div className="ps-kicker">{era ? era.name : ""} · draft board</div>
              <h3 className="ps-subhead">
                {phase === "ready"
                  ? "Roster complete."
                  : "Pick one player to fill an open slot."}
              </h3>
            </div>
            {phase === "draft" ? (
              <button
                className="ps-skip"
                onClick={skip}
                disabled={skips < 1}
                title="Re-spin this pool"
              >
                Skip pool · {skips} left
              </button>
            ) : null}
          </div>

          {phase === "draft" ? (
            <div className="ps-pool">
              {pool.map((p, i) => {
                const taken = Boolean(roster[p.pos]);
                return (
                  <button
                    key={`${p.name}-${i}`}
                    className={`ps-card ${taken ? "is-taken" : ""}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => pick(p)}
                    disabled={taken}
                  >
                    <span className="ps-card__pos">{p.pos}</span>
                    <span className="ps-card__name">{p.name}</span>
                    <span className="ps-card__rating">{p.rating}</span>
                    {taken ? <span className="ps-card__note">slot filled</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="ps-roster">
            {SLOTS.map((s) => (
              <div key={s} className={`ps-slotbox ${roster[s] ? "is-filled" : ""}`}>
                <span className="ps-slotbox__pos">{s}</span>
                <span className="ps-slotbox__name">
                  {roster[s] ? roster[s].name : "—"}
                </span>
                {roster[s] ? (
                  <span className="ps-slotbox__rating">{roster[s].rating}</span>
                ) : null}
              </div>
            ))}
          </div>

          {phase === "ready" ? (
            <div className="ps-ready ps-pop">
              <div className="ps-ready__rating">
                Team rating <strong>{teamRating(roster).toFixed(1)}</strong>
              </div>
              <button className="wr-btn ps-cta" onClick={playSeason}>
                Play the season
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "season" && currentGame ? (
        <div className="ps-season">
          <div className="ps-scoreline">
            <span className="ps-kicker">
              {currentGame.playoff ? "Playoffs" : `Week ${currentGame.week}`}
            </span>
            <span className="ps-record">
              {wins}–{losses}
            </span>
          </div>
          <div className="ps-matchup ps-pop" key={gameIndex}>
            <div className="ps-matchup__side">
              <span className="ps-matchup__team">Your Squad</span>
              <span className="ps-matchup__rating">{teamRating(roster).toFixed(0)}</span>
            </div>
            <span className="ps-matchup__vs">vs</span>
            <div className="ps-matchup__side">
              <span className="ps-matchup__team">{currentGame.name}</span>
              <span className="ps-matchup__rating">{currentGame.rating}</span>
            </div>
            {stamp ? (
              <span className={`ps-stamp ${stamp === "W" ? "ps-stamp--w" : "ps-stamp--l"}`}>
                {stamp === "W" ? "WIN" : "LOSS"}
              </span>
            ) : (
              <span className="ps-matchup__dots">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
          <div className="ps-strip">
            {schedule.map((g, i) => (
              <span
                key={i}
                className={`ps-strip__dot ${
                  results[i] === "W" ? "is-w" : results[i] === "L" ? "is-l" : ""
                } ${i === gameIndex ? "is-now" : ""}`}
                title={g.name}
              />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "done" ? (
        <div className={`ps-final ps-pop ${losses ? "ps-final--loss" : "ps-final--perfect"}`}>
          {perfect ? (
            <div className="ps-confetti" aria-hidden="true">
              {Array.from({ length: 26 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    left: `${(i * 137) % 100}%`,
                    animationDelay: `${(i % 9) * 0.18}s`
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className="ps-kicker">{perfect ? "Immortality" : "Final"}</div>
          <h2 className="ps-headline">
            <span className="ps-score">
              {wins}–{losses}
            </span>
          </h2>
          <p className="ps-copy">
            {perfect
              ? "A perfect season. Canton is calling — they're naming a wing after you."
              : losses
              ? `${schedule[gameIndex] ? schedule[gameIndex].name : "The football gods"} ended the dream${wins > 0 ? ` at ${wins}–0` : ""}. Spin again, coach.`
              : "Season complete."}
          </p>
          <div className="ps-reward">
            {reward && reward.ok !== false ? (
              <>
                +{reward.reward} Star Coins{perfect ? " · perfect-season bonus included" : ""}
              </>
            ) : reward ? (
              "Reward unavailable right now — coins next time."
            ) : (
              "Counting your winnings…"
            )}
          </div>
          <button className="wr-btn ps-cta" onClick={startDraft}>
            Run it back
          </button>
        </div>
      ) : null}
    </div>
  );
}
