import React from "react";

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
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <div className="site-footer__mark" aria-hidden="true">★</div>
          <div>
            <span className="site-footer__brand-name">LoneStar Analytics</span>
            <span className="site-footer__brand-tag">Independent NFL playoff intelligence.</span>
          </div>
        </div>

        <nav className="site-footer__links" aria-label="Footer">
          <a href="#dashboard" onClick={go("dashboard")}>Dashboard</a>
          <a href="#games" onClick={go("games")}>Games</a>
          <a href="#predictions" onClick={go("predictions")}>Predictions</a>
          <a href="#players" onClick={go("players")}>Players</a>
          <a href="#insights" onClick={go("insights")}>Insights</a>
        </nav>

        <div className="site-footer__meta">
          <span>© {year} LoneStar Analytics</span>
          <span aria-hidden="true">·</span>
          <span>Data: ESPN APIs</span>
          <span aria-hidden="true">·</span>
          <span>Educational use</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
