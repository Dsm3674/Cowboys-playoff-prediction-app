import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import PerfectSeason from "./PerfectSeason";

/*
 * War Room — Pro-only page.
 * Left: Star Coin prediction markets (Polymarket-style parimutuel pools).
 * Right: the War Room Analyst chatbot.
 * Locked behind the $1/month War Room Pro subscription; non-subscribers see
 * a paywall card that launches Stripe checkout.
 *
 * Color system: YES/NO are series colors (validated blue/red pair for the
 * dark card surface). Text stays in ink tokens; the colored dot beside a
 * label carries identity, never the text itself.
 */

function Paywall({ signedIn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function subscribe() {
    setBusy(true);
    setError("");
    try {
      const data = await api.startProCheckout();
      if (data && data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Unable to start checkout. Please try again.");
    } catch (err) {
      setError(err.message || "Unable to start checkout.");
    }
    setBusy(false);
  }

  return (
    <div className="wr-paywall">
      <div className="wr-paywall__badge">Pro exclusive</div>
      <h2 className="wr-paywall__title">The War Room is locked</h2>
      <p className="wr-paywall__copy">
        Trade Star Coins on Cowboys season outcomes, climb the leaderboard, and
        grill the War Room Analyst about playoff odds.
      </p>

      <div className="wr-paywall__price">
        <span className="wr-paywall__amount">$1</span>
        <span className="wr-paywall__per">
          per month
          <br />
          cancel anytime
        </span>
      </div>

      <ul className="wr-paywall__list">
        <li>
          <span className="wr-paywall__li-title">Prediction markets</span>
          <span>Polymarket-style odds on the playoffs, the NFC East, and more</span>
        </li>
        <li>
          <span className="wr-paywall__li-title">1,000 Star Coins</span>
          <span>Stake a side — winners split the whole pot when it resolves</span>
        </li>
        <li>
          <span className="wr-paywall__li-title">Leaderboard</span>
          <span>Season-long standings against other Pro members</span>
        </li>
        <li>
          <span className="wr-paywall__li-title">War Room Analyst</span>
          <span>A chatbot that knows the model and the market board</span>
        </li>
      </ul>

      {signedIn ? (
        <button className="wr-btn wr-btn--primary wr-paywall__cta" onClick={subscribe} disabled={busy}>
          {busy ? "Opening secure checkout…" : "Unlock the War Room"}
        </button>
      ) : (
        <p className="wr-paywall__signin">
          Sign in first — Gmail or an anonymous identity both work (use the
          sign-in on the home screen), then come back here to subscribe or
          unlock.
        </p>
      )}
      {error ? <div className="wr-error">{error}</div> : null}
      <div className="wr-paywall__note">
        Already subscribed? Sign in with the same account you used at checkout
        — Gmail or anonymous identity. Star Coins are virtual and have no cash
        value.
      </div>
    </div>
  );
}

function MarketCard({ market, onBet, busy }) {
  const [side, setSide] = useState("yes");
  const [amount, setAmount] = useState(25);

  const resolved = market.status !== "open";
  const hasPosition = market.myYesStake > 0 || market.myNoStake > 0;

  return (
    <article className={`wr-market ${resolved ? "wr-market--resolved" : ""}`}>
      <div className="wr-market__head">
        <span className="wr-market__cat">{market.category}</span>
        {resolved ? (
          <span className="wr-market__outcome">
            Resolved {String(market.outcome || "").toUpperCase()}
          </span>
        ) : (
          <span className="wr-market__chance">{market.yesPrice}% chance</span>
        )}
      </div>

      <h3 className="wr-market__q">{market.question}</h3>
      {market.detail ? <p className="wr-market__detail">{market.detail}</p> : null}

      {/* Share meter: two segments with a 2px surface gap, rounded data ends */}
      <div className="wr-meter" aria-hidden="true">
        <div className="wr-meter__yes" style={{ width: `${market.yesPrice}%` }} />
        <div className="wr-meter__no" style={{ width: `${market.noPrice}%` }} />
      </div>

      <div className="wr-market__prices" role="radiogroup" aria-label="Pick a side">
        <button
          type="button"
          className={`wr-chip wr-chip--yes ${side === "yes" ? "is-active" : ""}`}
          onClick={() => setSide("yes")}
          disabled={resolved}
          aria-pressed={side === "yes"}
        >
          <span className="wr-chip__dot wr-chip__dot--yes" />
          <span className="wr-chip__label">Yes</span>
          <span className="wr-chip__price">{market.yesPrice}¢</span>
        </button>
        <button
          type="button"
          className={`wr-chip wr-chip--no ${side === "no" ? "is-active" : ""}`}
          onClick={() => setSide("no")}
          disabled={resolved}
          aria-pressed={side === "no"}
        >
          <span className="wr-chip__dot wr-chip__dot--no" />
          <span className="wr-chip__label">No</span>
          <span className="wr-chip__price">{market.noPrice}¢</span>
        </button>
      </div>

      {hasPosition ? (
        <div className="wr-market__position">
          {market.myYesStake > 0 ? (
            <span>
              <span className="wr-chip__dot wr-chip__dot--yes" />
              {market.myYesStake.toFixed(0)} on Yes
            </span>
          ) : null}
          {market.myNoStake > 0 ? (
            <span>
              <span className="wr-chip__dot wr-chip__dot--no" />
              {market.myNoStake.toFixed(0)} on No
            </span>
          ) : null}
        </div>
      ) : null}

      {!resolved ? (
        <div className="wr-market__bet">
          <div className="wr-stake">
            <span className="wr-stake__unit">🪙</span>
            <input
              type="number"
              min="1"
              max="10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="wr-stake__input"
              aria-label="Stake in Star Coins"
            />
          </div>
          <button
            type="button"
            className={`wr-btn wr-btn--bet wr-btn--bet-${side}`}
            disabled={busy}
            onClick={() => onBet(market.id, side, Number(amount))}
          >
            Bet {side === "yes" ? "Yes" : "No"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Welcome to the War Room. Ask me about Cowboys playoff odds, how these markets work, or where the smart Star Coins are going. 🏈"
    }
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setThinking(true);
    try {
      const data = await api.sendWarRoomChat(
        next.filter((m) => m.role === "user" || m.role === "assistant")
      );
      setMessages((cur) => [...cur, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((cur) => [
        ...cur,
        {
          role: "assistant",
          content: err.message || "The analyst dropped the headset. Try again."
        }
      ]);
    }
    setThinking(false);
  }

  return (
    <aside className={`wr-chat-dock ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="wr-chat-launcher"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="war-room-analyst"
        title="War Room Analyst"
      >
        <span className="wr-chat-launcher__pulse" />
        <span className="wr-chat-launcher__mark">AI</span>
      </button>
    <section className="wr-chat" id="war-room-analyst" aria-hidden={!open}>
      <div className="wr-chat__head">
        <span className="wr-chat__dot" />
        <span className="wr-chat__tag">Live</span>
        <span className="wr-chat__name">War Room Analyst</span>
        <button
          type="button"
          className="wr-chat__close"
          onClick={() => setOpen(false)}
          aria-label="Close War Room Analyst"
        >
          x
        </button>
      </div>
      <div className="wr-chat__scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`wr-msg wr-msg--${m.role}`}>
            {m.content}
          </div>
        ))}
        {thinking ? (
          <div className="wr-msg wr-msg--assistant wr-msg--typing">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
      <form className="wr-chat__form" onSubmit={send}>
        <input
          className="wr-chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about odds, markets, matchups..."
          maxLength={2000}
        />
        <button className="wr-btn wr-btn--primary" type="submit" disabled={thinking}>
          Send
        </button>
      </form>
    </section>
    </aside>
  );
}

export default function WarRoomPage() {
  const [status, setStatus] = useState(null); // { signedIn, pro }
  const [wallet, setWallet] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState("");
  const [betting, setBetting] = useState(false);
  const [flash, setFlash] = useState("");
  const [mode, setMode] = useState("markets"); // markets | season

  async function loadMarkets() {
    const data = await api.getWarRoomMarkets();
    setWallet(data.wallet);
    setMarkets(data.markets);
    try {
      const lb = await api.getWarRoomLeaderboard();
      setLeaderboard(lb.leaderboard || []);
    } catch (_err) {
      // Leaderboard is decorative — don't fail the page over it.
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.getWarRoomStatus();
        if (cancelled) return;
        setStatus(s);
        if (s.pro) await loadMarkets();
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to reach the War Room.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBet(marketId, side, amount) {
    if (!Number.isFinite(amount) || amount < 1) {
      setFlash("Stake at least 1 Star Coin.");
      return;
    }
    setBetting(true);
    setFlash("");
    try {
      const data = await api.placeWarRoomBet(marketId, side, amount);
      setWallet((w) => ({ ...(w || {}), balance: data.balance }));
      setMarkets((cur) => cur.map((m) => (m.id === data.market.id ? data.market : m)));
      setFlash(`Bet placed — ${amount} Star Coins on ${side.toUpperCase()}.`);
      try {
        const lb = await api.getWarRoomLeaderboard();
        setLeaderboard(lb.leaderboard || []);
      } catch (_err) {}
    } catch (err) {
      setFlash(err.message || "Unable to place that bet.");
    }
    setBetting(false);
  }

  const atRisk = markets.reduce(
    (s, m) => s + (m.myYesStake || 0) + (m.myNoStake || 0),
    0
  );

  if (error) {
    return (
      <div className="wr-page">
        <div className="wr-error">{error}</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="wr-page">
        <div className="wr-loading">Opening the War Room…</div>
      </div>
    );
  }

  if (!status.pro) {
    return (
      <div className="wr-page">
        <Paywall signedIn={status.signedIn} />
      </div>
    );
  }

  return (
    <div className="wr-page">
      <header className="wr-topbar">
        <div className="wr-topbar__intro">
          <div className="wr-dateline">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}
            <span className="wr-dateline__sep">·</span> Star Coin Exchange
          </div>
          <h2 className="wr-title">Prediction market desk</h2>
          <p className="wr-sub">
            Prices are the crowd's probability in cents. Star Coins are virtual —
            bragging rights only.
          </p>
        </div>
        <div className="wr-tiles">
          <div className="wr-tile">
            <span className="wr-tile__label">Star Coin balance</span>
            <span className="wr-tile__value">
              {wallet ? Number(wallet.balance).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
            </span>
          </div>
          <div className="wr-tile">
            <span className="wr-tile__label">At risk in markets</span>
            <span className="wr-tile__value">
              {atRisk.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </header>

      <nav className="wr-modes" aria-label="Game mode" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "markets"}
          className={`wr-mode ${mode === "markets" ? "is-active" : ""}`}
          onClick={() => setMode("markets")}
        >
          The Markets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "season"}
          className={`wr-mode ${mode === "season" ? "is-active" : ""}`}
          onClick={() => setMode("season")}
        >
          Perfect Season
          <span className="wr-mode__tag">Game</span>
        </button>
      </nav>

      {flash ? <div className="wr-flash">{flash}</div> : null}

      <div className={`wr-layout ${mode === "season" ? "wr-layout--wide" : ""}`}>
        <div className="wr-left" key={mode}>
          {mode === "season" ? (
            <PerfectSeason
              onReward={(balance) => setWallet((w) => ({ ...(w || {}), balance }))}
            />
          ) : (
          <>
          <div className="wr-markets">
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} onBet={handleBet} busy={betting} />
            ))}
          </div>
          {leaderboard.length ? (
            <section className="wr-board">
              <h3 className="wr-board__title">Leaderboard</h3>
              <ol className="wr-board__list">
                {leaderboard.map((row) => (
                  <li key={row.rank} className={row.you ? "is-you" : ""}>
                    <span className="wr-board__rank">{row.rank}</span>
                    <span className="wr-board__player">
                      {row.player}
                      {row.you ? <span className="wr-board__you">You</span> : null}
                    </span>
                    <span className="wr-board__worth">
                      {row.netWorth.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="wr-board__note">Net worth = balance + open stakes</div>
            </section>
          ) : null}
          </>
          )}
        </div>
      </div>
      <ChatPanel />
    </div>
  );
}
