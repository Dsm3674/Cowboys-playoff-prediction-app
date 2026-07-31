import React from "react";
import { api } from "../api";

/**
 * About — visible only to a signed-in user.
 *
 * Sign-in state is whatever api.getSignedInUser() resolves from the stored
 * auth blob or the identity cookie; an empty string means signed out. The
 * gate is a UX affordance, not a security boundary — nothing here is secret,
 * it is just not shown to anonymous visitors.
 */

const SECTIONS = [
  {
    title: "What this is",
    body: "LoneStar is a Dallas Cowboys season model. It rebuilds Elo power ratings from "
      + "every completed game, simulates the playoff bracket under real NFL seeding rules, "
      + "and reports where the season is likely to land — with the working shown rather "
      + "than a single number handed down.",
  },
  {
    title: "How the ratings work",
    body: "Elo with a margin-of-victory multiplier, a +48 home-field edge, and a K of 20. "
      + "Ratings replay from scratch on every request, so a new result is folded in without "
      + "a weekly batch job. A persisted adjustment layer carries what results cannot yet "
      + "see: quarterback outs, injury clusters, trades.",
  },
  {
    title: "Where the market comes in",
    body: "Super Bowl futures are de-vigged with Shin's method and used two ways: as a "
      + "preseason prior, because a carryover rating cannot see free agency or the draft, "
      + "and as a benchmark the model is scored against. The two are pooled into a blended "
      + "forecast weighted by how far into the season we are — the market leads in "
      + "September, the model stands on its own by December.",
  },
  {
    title: "What it is not",
    body: "Not betting advice, and not a sportsbook. Odds appear as a modelling input and "
      + "a sanity check, never as a pick or a recommended wager. Star Coins in the War Room "
      + "are virtual and have no cash value.",
  },
];

const ENGINES = [
  { name: "Elo power ratings", detail: "Replayed from completed games, MOV-weighted" },
  { name: "Playoff path simulator", detail: "25k Monte Carlo brackets, real reseeding" },
  { name: "Clutch index", detail: "Play-by-play scan of high-leverage snaps" },
  { name: "Performance map", detail: "Consistency against explosiveness by player" },
  { name: "Timeline", detail: "Cumulative season momentum by event" },
  { name: "Market check", detail: "Shin de-vig, KL divergence against the model" },
];

export default function AboutPage() {
  const [user, setUser] = React.useState(() => {
    try {
      return typeof api.getSignedInUser === "function" ? api.getSignedInUser() : "";
    } catch (_err) {
      return "";
    }
  });

  /* Sign-in happens outside React (the entry gate writes localStorage), so
     pick up a change when the tab regains focus or another tab signs in. */
  React.useEffect(() => {
    function refresh() {
      try {
        setUser(typeof api.getSignedInUser === "function" ? api.getSignedInUser() : "");
      } catch (_err) {
        setUser("");
      }
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!user) {
    return (
      <div className="intel-page">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">About</div>
            <h1 className="intel-title">Sign in to read this</h1>
            <p className="intel-subtitle">
              The about page — what the model does, how the ratings are built, and where
              market odds fit in — is available once you're signed in.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page">
      <style>{`
        .about-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
        }
        .about-card {
          background: rgba(10,22,40,.82);
          border: 1px solid rgba(255,255,255,.07);
          border-left: 3px solid #3987e5;
          border-radius: 12px;
          padding: 1.15rem 1.25rem;
        }
        .about-card h3 {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 .5rem;
        }
        .about-card p {
          font-size: 13.5px;
          line-height: 1.65;
          color: #a1aec5;
          margin: 0;
        }
        .about-engines {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-top: .25rem;
        }
        .about-engine {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          padding: .7rem .85rem;
        }
        .about-engine__name { font-size: 12.5px; font-weight: 700; color: #cfe3fb; }
        .about-engine__detail { font-size: 11.5px; color: #7a8fa8; margin-top: 3px; }
        .about-signed {
          font-family: ui-monospace, monospace;
          font-size: 11px;
          color: #7a8fa8;
        }
      `}</style>

      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">About</div>
          <h1 className="intel-title">How LoneStar works</h1>
          <p className="intel-subtitle">
            The model, the data behind it, and the limits of what it claims.
          </p>
        </div>
        <div className="intel-hero__meta">
          <div className="intel-chip intel-chip--muted">
            <span className="about-signed">{user}</span>
          </div>
        </div>
      </section>

      <section className="about-grid">
        {SECTIONS.map((section) => (
          <article className="about-card" key={section.title}>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <section className="intel-panel" style={{ marginTop: "1.25rem" }}>
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Engines</h2>
        </div>
        <div className="about-engines">
          {ENGINES.map((engine) => (
            <div className="about-engine" key={engine.name}>
              <div className="about-engine__name">{engine.name}</div>
              <div className="about-engine__detail">{engine.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="intel-panel" style={{ marginTop: "1.25rem" }}>
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Data sources</h2>
        </div>
        <p style={{ lineHeight: 1.7, fontSize: "13.5px", color: "#a1aec5" }}>
          Schedules, scores and play-by-play come from ESPN's public feeds. Super Bowl
          futures come from a stored book-consensus snapshot, refreshed from The Odds API
          when a key is configured. When a feed is unreachable the app falls back to
          clearly-labelled projected data rather than presenting a gap as fact.
        </p>
      </section>
    </div>
  );
}

window.AboutPage = AboutPage;
