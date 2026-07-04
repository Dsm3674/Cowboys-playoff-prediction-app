import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

/*
 * War Room — Pro-only page.
 * Left: Star Coin prediction markets (Polymarket-style parimutuel pools).
 * Right: the War Room Analyst chatbot.
 * Locked behind the $1/month War Room Pro subscription; non-subscribers see
 * a paywall card that launches Stripe checkout.
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
      <div className="wr-paywall__badge">★ Pro exclusive</div>
      <h2 className="wr-paywall__title">The War Room is locked.</h2>
      <p className="wr-paywall__copy">
        Bet Star Coins on Cowboys season outcomes in a live prediction market,
        climb the leaderboard, and grill the War Room Analyst — our resident
        chatbot — about playoff odds. All of it is included with War Room Pro
        for <strong>$1/month</strong>.
      </p>
      <ul className="wr-paywall__list">
        <li>🎯 Polymarket-style markets on playoff odds, the NFC East, and more</li>
        <li>🪙 1,000 Star Coins to start — winners split the pot</li>
        <li>🏆 Season-long leaderboard against other Pro members</li>
        <li>🤖 The War Room Analyst chatbot, on call 24/7</li>
      </ul>
      {signedIn ? (
        <button className="wr-btn wr-btn--primary" onClick={subscribe} disabled={busy}>
          {busy ? "Opening secure checkout…" : "Unlock with Pro — $1/month"}
        </button>
      ) : (
        <p className="wr-paywall__signin">
          Sign in with your Gmail account first (use the sign-in on the home
          screen), then come back here to subscribe or unlock.
        </p>
      )}
      {error ? <div className="wr-error">{error}</div> : null}
      <div className="wr-paywall__note">
        Already subscribed? Make sure you're signed in with the same Gmail you
        used at checkout.
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
            Resolved: {String(market.outcome || "").toUpperCase()}
          </span>
        ) : null}
      </div>
      <h3 className="wr-market__q">{market.question}</h3>
      {market.detail ? <p className="wr-market__detail">{market.detail}</p> : null}

      <div className="wr-market__prices">
        <button
          type="button"
          className={`wr-price wr-price--yes ${side === "yes" ? "is-active" : ""}`}
          onClick={() => setSide("yes")}
          disabled={resolved}
        >
          YES {market.yesPrice}¢
        </button>
        <button
          type="button"
          className={`wr-price wr-price--no ${side === "no" ? "is-active" : ""}`}
          onClick={() => setSide("no")}
          disabled={resolved}
        >
          NO {market.noPrice}¢
        </button>
      </div>

      <div className="wr-market__bar">
        <div className="wr-market__bar-yes" style={{ width: `${market.yesPrice}%` }} />
      </div>

      {hasPosition ? (
        <div className="wr-market__position">
          Your stake:{" "}
          {market.myYesStake > 0 ? `${market.myYesStake.toFixed(0)} on YES` : ""}
          {market.myYesStake > 0 && market.myNoStake > 0 ? " · " : ""}
          {market.myNoStake > 0 ? `${market.myNoStake.toFixed(0)} on NO` : ""}
        </div>
      ) : null}

      {!resolved ? (
        <div className="wr-market__bet">
          <input
            type="number"
            min="1"
            max="10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="wr-market__stake"
            aria-label="Stake in Star Coins"
          />
          <button
            type="button"
            className="wr-btn wr-btn--bet"
            disabled={busy}
            onClick={() => onBet(market.id, side, Number(amount))}
          >
            Bet {side.toUpperCase()}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ChatPanel() {
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
    <section className="wr-chat">
      <div className="wr-chat__head">
        <span className="wr-chat__dot" /> War Room Analyst
      </div>
      <div className="wr-chat__scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`wr-msg wr-msg--${m.role}`}>
            {m.content}
          </div>
        ))}
        {thinking ? <div className="wr-msg wr-msg--assistant wr-msg--typing">…</div> : null}
      </div>
      <form className="wr-chat__form" onSubmit={send}>
        <input
          className="wr-chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about odds, markets, matchups…"
          maxLength={2000}
        />
        <button className="wr-btn wr-btn--primary" type="submit" disabled={thinking}>
          Send
        </button>
      </form>
    </section>
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
      setFlash(`Bet placed: ${amount} Star Coins on ${side.toUpperCase()}. 🤝`);
      try {
        const lb = await api.getWarRoomLeaderboard();
        setLeaderboard(lb.leaderboard || []);
      } catch (_err) {}
    } catch (err) {
      setFlash(err.message || "Unable to place that bet.");
    }
    setBetting(false);
  }

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
        <div>
          <h1 className="wr-title">The War Room</h1>
          <p className="wr-sub">
            Star Coin prediction markets + your personal analyst. Prices are the
            crowd's probability in cents. Coins are virtual — bragging rights only.
          </p>
        </div>
        <div className="wr-wallet">
          <span className="wr-wallet__label">Your wallet</span>
          <span className="wr-wallet__coins">
            🪙 {wallet ? Number(wallet.balance).toFixed(0) : "—"}
          </span>
        </div>
      </header>

      {flash ? <div className="wr-flash">{flash}</div> : null}

      <div className="wr-layout">
        <div className="wr-markets">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} onBet={handleBet} busy={betting} />
          ))}
          {leaderboard.length ? (
            <section className="wr-board">
              <h3 className="wr-board__title">🏆 Leaderboard</h3>
              <ol className="wr-board__list">
                {leaderboard.map((row) => (
                  <li key={row.rank} className={row.you ? "is-you" : ""}>
                    <span>
                      #{row.rank} {row.player}
                      {row.you ? " (you)" : ""}
                    </span>
                    <span>🪙 {row.netWorth}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
        <ChatPanel />
      </div>
    </div>
  );
}
