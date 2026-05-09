import React from "react";

/**
 * Footer
 * Sits at the bottom of every page. Contains brand copy, internal links,
 * legal links, and a contact line. Uses sectioning + nav for accessibility.
 */
function Footer() {
  const year = new Date().getFullYear();

  function go(page) {
    return (e) => {
      e.preventDefault();
      if (typeof window.setPage === "function") {
        window.setPage(page);
      } else {
        window.location.hash = page;
      }
    };
  }

  return (
    <footer className="site-footer" role="contentinfo">
      {/* ── Top rule with accent ── */}
      <div className="site-footer__rule" aria-hidden="true" />

      <div className="site-footer__inner">
        {/* ── Brand column ── */}
        <div className="site-footer__brand-col">
          <div className="site-footer__brand">
            <div className="site-footer__mark" aria-hidden="true">★</div>
            <div>
              <div className="site-footer__brand-name">LoneStar Analytics</div>
              <div className="site-footer__brand-tag">
                Independent NFL playoff intelligence.
              </div>
            </div>
          </div>
          <p className="site-footer__disclaimer">
            Not affiliated with the NFL, any team, or any league entity.
            All data sourced from public ESPN APIs for educational purposes.
          </p>
          <div className="site-footer__badges">
            <span className="site-footer__badge">Quantum v4.6</span>
            <span className="site-footer__badge">100k Sims</span>
            <span className="site-footer__badge">32 Teams</span>
          </div>
        </div>

        {/* ── Link columns ── */}
        <nav className="site-footer__nav" aria-label="Footer">
          <div className="site-footer__col">
            <h4 className="site-footer__heading">Product</h4>
            <a href="#dashboard" onClick={go("dashboard")}>Dashboard</a>
            <a href="#games" onClick={go("games")}>Games</a>
            <a href="#predictions" onClick={go("predictions")}>Predictions</a>
            <a href="#players" onClick={go("players")}>Players</a>
            <a href="#insights" onClick={go("insights")}>Insights</a>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__heading">Resources</h4>
            <a href="#about" onClick={(e) => e.preventDefault()}>About</a>
            <a href="#changelog" onClick={(e) => e.preventDefault()}>Changelog</a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a href="mailto:hello@lonestar-analytics.app">Contact</a>
          </div>

          <div className="site-footer__col">
            <h4 className="site-footer__heading">Legal</h4>
            <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
            <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <a href="#cookies" onClick={(e) => e.preventDefault()}>Cookie Policy</a>
            <a href="#disclaimer" onClick={(e) => e.preventDefault()}>Disclaimer</a>
          </div>
        </nav>
      </div>

      {/* ── Bottom bar ── */}
      <div className="site-footer__bar">
        <div className="site-footer__copyright">
          © {year} LoneStar Analytics. All rights reserved.
        </div>
        <div className="site-footer__meta">
          <span>Data: ESPN public APIs</span>
          <span className="site-footer__meta-dot" aria-hidden="true">·</span>
          <span>Built for educational use</span>
          <span className="site-footer__meta-dot" aria-hidden="true">·</span>
          <span>Dallas, TX</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
