function UserProfileCard() {
  const [username, setUsername] = React.useState("");
  const [theme, setTheme] = React.useState("default");
  const [hasProfile, setHasProfile] = React.useState(false);
  const [pollChoice, setPollChoice] = React.useState(null);
  const [pollResults, setPollResults] = React.useState({ yes: 0, no: 0 });

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ls_profile") || "null");
      if (saved && saved.username) {
        setUsername(saved.username);
        setTheme(saved.theme || "default");
        setHasProfile(true);
        applyTheme(saved.theme || "default");
      }

      const savedPoll = JSON.parse(
        localStorage.getItem("ls_pollResults") || "null"
      );
      if (savedPoll) {
        setPollResults(savedPoll.results || { yes: 0, no: 0 });
        setPollChoice(savedPoll.choice || null);
      }
    } catch (e) {
      console.warn("UserProfileCard: failed to parse localStorage", e);
    }
  }, []);

  const applyTheme = (themeValue) => {
    if (!themeValue || themeValue === "default") {
      document.body.className = "";
    } else {
      document.body.className = themeValue;
    }
  };

  const saveProfile = (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    const profile = { username: username.trim(), theme };
    localStorage.setItem("ls_profile", JSON.stringify(profile));
    setHasProfile(true);
    applyTheme(theme);
  };

  const handleThemeChange = (e) => {
    const value = e.target.value;
    setTheme(value);
    applyTheme(value);
    if (hasProfile && username.trim()) {
      localStorage.setItem(
        "ls_profile",
        JSON.stringify({ username: username.trim(), theme: value })
      );
    }
  };

  const vote = (choice) => {
    setPollChoice(choice);

    const updated = { ...pollResults };
    if (choice === "yes") updated.yes += 1;
    if (choice === "no") updated.no += 1;

    setPollResults(updated);
    localStorage.setItem(
      "ls_pollResults",
      JSON.stringify({ choice, results: updated })
    );
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

  return (
    <div className="card">
      <h3>User Profile</h3>
      {!hasProfile ? (
        <>
          <p className="text-muted">
            Create a simple profile to save your theme and prediction history.
          </p>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label>Username:</label>
              <input
                type="text"
                placeholder="e.g. DakDataNerd"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Theme:</label>
              <select value={theme} onChange={handleThemeChange}>
                <option value="default">Default</option>
                <option value="dark">Dark Mode</option>
                <option value="retro">Retro Console</option>
              </select>
            </div>

            <button className="btn-primary" type="submit" style={{ width: "100%" }}>
              Create Profile
            </button>
          </form>
        </>
      ) : (
        <>
          <p style={{ marginBottom: "0.5rem" }}>
            Logged in as <strong>{username}</strong>
          </p>

          <div className="form-group">
            <label>Theme:</label>
            <select value={theme} onChange={handleThemeChange}>
              <option value="default">Default</option>
              <option value="dark">Dark Mode</option>
              <option value="retro">Retro Console</option>
            </select>
          </div>

          <small className="text-muted">
            Theme + profile are stored locally in your browser.
          </small>

          <button
            type="button"
            className="btn-secondary"
            style={{
              marginTop: "0.75rem",
              width: "100%",
            }}
            onClick={logout}
          >
            Log out
          </button>

          <hr style={{ margin: "1.5rem 0", borderColor: "var(--slate-300)" }} />

          <h4 style={{ marginTop: 0 }}>Community Poll</h4>
          <p className="text-muted">
            Will the Cowboys make the NFC Championship this season?
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <button
              type="button"
              className="btn-primary"
              style={{
                flex: 1,
                opacity: pollChoice === "yes" ? 1 : 0.7,
              }}
              onClick={() => vote("yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className="btn-danger"
              style={{
                flex: 1,
                opacity: pollChoice === "no" ? 1 : 0.7,
              }}
              onClick={() => vote("no")}
            >
              No
            </button>
          </div>

          <p className="text-small">
            Votes – Yes: <strong>{pollResults.yes}</strong>, No:{" "}
            <strong>{pollResults.no}</strong>
          </p>

          {pollChoice && (
            <p className="text-small text-muted">
              You voted: <strong>{pollChoice.toUpperCase()}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );
}

window.UserProfileCard = UserProfileCard;
