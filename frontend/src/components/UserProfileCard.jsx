import React from "react";

function UserProfileCard() {
  const THEMES = [
    { value: "default", label: "Default Navy", note: "Original LoneStar look" },
    { value: "midnight", label: "Midnight Glass", note: "Deep blue premium look" },
    { value: "silver", label: "Silver Huddle", note: "Cool metallic Cowboys palette" },
    { value: "emerald", label: "Emerald Pulse", note: "Green market-style glow" },
    { value: "sunset", label: "Sunset Signal", note: "Warm orange and magenta" },
    { value: "victory", label: "Victory Gold", note: "Warm stadium-light accents" },
    { value: "retro", label: "Retro Console", note: "Terminal-inspired neon" },
  ];

  const [username, setUsername] = React.useState("");
  const [theme, setTheme] = React.useState("default");
  const [hasProfile, setHasProfile] = React.useState(false);
  const [pollChoice, setPollChoice] = React.useState(null);
  const [pollResults, setPollResults] = React.useState({ yes: 0, no: 0 });

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ls_profile") || "null");
      if (saved?.username) {
        setUsername(saved.username);
        setTheme(saved.theme || "default");
        setHasProfile(true);
        applyTheme(saved.theme || "default");
      }

      const savedPoll = JSON.parse(localStorage.getItem("ls_pollResults") || "null");
      if (savedPoll) {
        setPollResults(savedPoll.results || { yes: 0, no: 0 });
        setPollChoice(savedPoll.choice || null);
      }
    } catch (e) {
      console.warn("UserProfileCard: failed to parse localStorage", e);
    }
  }, []);

  const applyTheme = (themeValue) => {
    document.body.classList.remove(
      "theme-midnight",
      "theme-silver",
      "theme-emerald",
      "theme-sunset",
      "theme-victory",
      "theme-retro"
    );

    if (themeValue === "midnight") document.body.classList.add("theme-midnight");
    if (themeValue === "silver") document.body.classList.add("theme-silver");
    if (themeValue === "emerald") document.body.classList.add("theme-emerald");
    if (themeValue === "sunset") document.body.classList.add("theme-sunset");
    if (themeValue === "victory") document.body.classList.add("theme-victory");
    if (themeValue === "retro") document.body.classList.add("theme-retro");
  };

  const persistProfile = (nextUsername, nextTheme) => {
    localStorage.setItem(
      "ls_profile",
      JSON.stringify({
        username: nextUsername.trim(),
        theme: nextTheme,
      })
    );
  };

  const saveProfile = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    persistProfile(username, theme);
    setHasProfile(true);
    applyTheme(theme);
  };

  const handleThemeChange = (e) => {
    const value = e.target.value;
    setTheme(value);
    applyTheme(value);

    if (hasProfile && username.trim()) {
      persistProfile(username, value);
    }
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
    setTheme("default");
    setHasProfile(false);
    setPollChoice(null);
    setPollResults({ yes: 0, no: 0 });
    applyTheme("default");
  };

  const activeTheme = THEMES.find((item) => item.value === theme) || THEMES[0];

  const renderThemePicker = () => (
    <div className="theme-option-grid">
      {THEMES.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`theme-option-card ${theme === item.value ? "is-active" : ""}`}
          aria-pressed={theme === item.value}
          aria-label={`${item.label} theme`}
          onClick={() => handleThemeChange({ target: { value: item.value } })}
        >
          <div className={`theme-preview theme-preview--${item.value}`}>
            <span />
            <span />
            <span />
          </div>
          <div className="theme-option-copy">
            <div className="theme-option-title">{item.label}</div>
            <div className="theme-option-note">{item.note}</div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="intel-page">
      <section className="intel-hero">
        <div className="intel-hero__copy">
          <div className="intel-kicker">Identity & Personalization</div>
          <h1 className="intel-title">User Profile</h1>
          <p className="intel-subtitle">
            Save your local profile, switch app themes, and keep your analytics workspace feeling personalized.
          </p>
        </div>

        <div className="intel-hero__meta">
          <div className="intel-chip">{hasProfile ? username : "Guest"}</div>
          <div className="intel-chip intel-chip--muted">{activeTheme.label}</div>
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

              <div className="intel-form-group">
                <label className="intel-label">Theme</label>
                {renderThemePicker()}
                <div className="text-muted" style={{ marginTop: 8 }}>{activeTheme.note}</div>
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
                  <div className="intel-metric-card__label">Theme</div>
                  <div className="intel-metric-card__value">{activeTheme.label}</div>
                </div>
              </div>

              <div className="intel-form-group">
                <label className="intel-label">Switch Theme</label>
                {renderThemePicker()}
                <div className="text-muted" style={{ marginTop: 8 }}>{activeTheme.note}</div>
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

window.UserProfileCard = UserProfileCard;

export default UserProfileCard;
