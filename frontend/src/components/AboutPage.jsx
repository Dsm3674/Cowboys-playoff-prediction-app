import React from "react";
import { api } from "../api";

/**
 * About — visible only to a signed-in user.
 *
 * Sign-in state is whatever api.getSignedInUser() resolves from the stored
 * auth blob or the identity cookie; an empty string means signed out. The
 * gate is a UX affordance, not a security boundary — nothing here is secret,
 * it is just not shown to anonymous visitors.
 *
 * Presentation lives in styles/About.css and is built on the workspace design
 * tokens, so this page inherits the same ink/cream/electric palette, panel
 * geometry and type scale as every other page instead of carrying its own.
 */

/** Headline constants of the model, pulled from the copy below. */
const FIGURES = [
  { value: "20", label: "Elo K-factor" },
  { value: "+48", label: "Home field" },
  { value: "25k", label: "Simulations" },
  { value: "32", label: "Teams rated" },
];

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
    caution: true,
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

const SOURCES = [
  {
    name: "ESPN public APIs",
    detail: "Schedules, scores and play-by-play. Everything the ratings replay is built from.",
  },
  {
    name: "The Odds API",
    detail: "Super Bowl futures, read from a stored book-consensus snapshot and refreshed "
      + "live when an API key is configured.",
  },
  {
    name: "Projected fallback",
    detail: "When a feed is unreachable the app falls back to clearly-labelled projected "
      + "data rather than presenting a gap as fact.",
  },
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
      <div className="intel-page about">
        <section className="intel-hero">
          <div className="intel-hero__copy">
            <div className="intel-kicker">About</div>
            <h1 className="intel-title">How LoneStar works</h1>
            <p className="intel-subtitle">
              The model, the data behind it, and the limits of what it claims.
            </p>
          </div>
        </section>

        <section className="about-gate">
          <div className="about-gate__mark" aria-hidden="true">✦</div>
          <h2 className="about-gate__title">Sign in to read this</h2>
          <p className="about-gate__body">
            The about page — what the model does, how the ratings are built, and where
            market odds fit in — is available once you're signed in. Nothing here is
            secret; it just isn't shown to anonymous visitors.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="intel-page about">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">About</div>
          <h1 className="intel-title">How LoneStar works</h1>
          <p className="intel-subtitle">
            The model, the data behind it, and the limits of what it claims.
          </p>
        </div>
        <div className="intel-hero__meta">
          <span className="intel-chip intel-chip--muted">Hybrid Elo v2</span>
          <span className="intel-chip intel-chip--success about__identity">
            <span className="about__identity-dot" aria-hidden="true" />
            <span className="about__identity-user">{user}</span>
          </span>
        </div>
      </section>

      <section className="about-figures" aria-label="Model constants">
        {FIGURES.map((figure) => (
          <div className="about-figure" key={figure.label}>
            <div className="about-figure__value">{figure.value}</div>
            <div className="about-figure__label">{figure.label}</div>
          </div>
        ))}
      </section>

      <section className="about-grid" aria-label="Method">
        {SECTIONS.map((section, index) => (
          <article
            className={`about-card${section.caution ? " about-card--caution" : ""}`}
            key={section.title}
          >
            <div className="about-card__index">{String(index + 1).padStart(2, "0")}</div>
            <h2 className="about-card__title">{section.title}</h2>
            <p className="about-card__body">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="intel-panel">
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Engines</h2>
          <span className="intel-section-meta text-muted">{ENGINES.length} running</span>
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

      <section className="intel-panel">
        <div className="intel-panel__header">
          <h2 className="intel-section-title">Data sources</h2>
        </div>
        <div className="about-sources">
          {SOURCES.map((source) => (
            <div className="about-source" key={source.name}>
              <div className="about-source__name">{source.name}</div>
              <div className="about-source__detail">{source.detail}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

window.AboutPage = AboutPage;
