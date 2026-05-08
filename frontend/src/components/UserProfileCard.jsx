import React from "react";

function UserProfileCard() {
  const [username, setUsername] = React.useState("");
  const [hasProfile, setHasProfile] = React.useState(false);
  const [pollChoice, setPollChoice] = React.useState(null);
  const [pollResults, setPollResults] = React.useState({ yes: 0, no: 0 });

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ls_profile") || "null");
      if (saved?.username) {
        setUsername(saved.username);
        setHasProfile(true);
      }

      const savedPoll = JSON.parse(localStorage.getItem("ls_pollResults") || "null");
      if (savedPoll) {
        setPollResults(savedPoll.results || { yes: 0, no: 0 });
        setPollChoice(savedPoll.choice || null);
      }
    } catch (e) {
      console.warn("UserProfileCard: failed to parse localStorage", e);
    }

    // Strip any old theme classes the previous version may have applied,
    // so we don't leave the body in a non-default theme after upgrade.
    document.body.classList.remove(
      "theme-midnight",
      "theme-silver",
      "theme-emerald",
      "theme-sunset",
      "theme-victory",
      "theme-retro"
    );
  }, []);

  const persistProfile = (nextUsername) => {
    localStorage.setItem(
      "ls_profile",
      JSON.stringify({ username: nextUsername.trim() })
    );
  };

  const saveProfile = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    persistProfile(username);
    setHasProfile(true);
  };

  const vote = (choice) => {
    const updated = { ...pollResults };
    if (choice === "yes") updated.yes += 1;
    if (choice === "no") updated.no += 1;

    setPollChoice(choice);
    setPollResults(updated);
    localStorage.setItem("ls_pollResults", JSON.stringify({ choice, results: updated }));
  };

  const logout = () => {
    try {
      localStorage.removeItem("ls_profile");
      localStorage.removeItem("ls_pollResults");
    } catch (e) {
      console.warn("UserProfileCard: failed to clear profile", e);
    }

    setUsername("");
    setHasProfile(false);
    setPollChoice(null);
    setPollResults({ yes: 0, no: 0 });
  };

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Identity</div>
          <h1 className="intel-title">User Profile</h1>
          <p className="intel-subtitle">
            Save your local profile and vote on weekly community polls. Your data stays in this browser.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{hasProfile ? username : "Guest"}</div>
        </div>
      </section>

      <section className="intel-grid intel-grid--main">
        <article className="intel-panel intel-panel--primary">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">{hasProfile ? "Profile Settings" : "Create Profile"}</h2>
          </div>

          {!hasProfile ? (
            <form onSubmit={saveProfile} className="intel-stack">
              <div className="intel-form-group">
                <label className="intel-label">Username</label>
                <input
                  type="text"
                  className="intel-select"
                  placeholder="e.g. DakDataNerd"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <button className="intel-button intel-button--primary" type="submit">
                Create Profile
              </button>
            </form>
          ) : (
            <div className="intel-stack">
              <div className="intel-metric-grid">
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Username</div>
                  <div className="intel-metric-card__value">{username}</div>
                </div>
                <div className="intel-metric-card">
                  <div className="intel-metric-card__label">Status</div>
                  <div className="intel-metric-card__value">Active</div>
                </div>
              </div>

              <button className="intel-button" type="button" onClick={logout}>
                Log Out
              </button>
            </div>
          )}
        </article>

        <article className="intel-panel">
          <div className="intel-panel__header">
            <h2 className="intel-section-title">Community Poll</h2>
          </div>

          <div className="intel-stack">
            <div className="text-muted">Will the Cowboys make the NFC Championship this season?</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                type="button"
                className="intel-button intel-button--primary"
                style={{ opacity: pollChoice === "yes" ? 1 : 0.82 }}
                onClick={() => vote("yes")}
              >
                Yes
              </button>

              <button
                type="button"
                className="intel-button"
                style={{ opacity: pollChoice === "no" ? 1 : 0.82 }}
                onClick={() => vote("no")}
              >
                No
              </button>
            </div>

            <div className="intel-metric-grid">
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">Yes Votes</div>
                <div className="intel-metric-card__value">{pollResults.yes}</div>
              </div>
              <div className="intel-metric-card">
                <div className="intel-metric-card__label">No Votes</div>
                <div className="intel-metric-card__value">{pollResults.no}</div>
              </div>
            </div>

            {pollChoice ? (
              <div className="intel-story-panel">
                You voted <strong>{pollChoice.toUpperCase()}</strong>.
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}

export default UserProfileCard;
