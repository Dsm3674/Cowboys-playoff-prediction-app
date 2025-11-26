

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
    // If profile exists, persist immediately
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

  return (
    <div className="card">
      <h3>User Profile</h3>
      {!hasProfile ? (
        <>
          <p style={{ color: "#555", fontSize: "0.9rem" }}>
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

            <button className="btn-primary" type="submit">
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

          <small style={{ color: "#777" }}>
            Theme + profile are stored locally in your browser.
          </small>

          <hr style={{ margin: "1.5rem 0" }} />

          <h4 style={{ marginTop: 0 }}>Community Poll</h4>
          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            Will the Cowboys make the NFC Championship this season?
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <button
              type="button"
              className="btn-primary"
              style={{
                flex: 1,
                opacity: pollChoice === "yes" ? 1 : 0.85,
              }}
              onClick={() => vote("yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{
                flex: 1,
                background: "#d20a0a",
                opacity: pollChoice === "no" ? 1 : 0.85,
              }}
              onClick={() => vote("no")}
            >
              No
            </button>
          </div>

          <p style={{ fontSize: "0.85rem", color: "#444" }}>
            Votes – Yes: <strong>{pollResults.yes}</strong>, No:{" "}
            <strong>{pollResults.no}</strong>
          </p>

          {pollChoice && (
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              You voted: <strong>{pollChoice.toUpperCase()}</strong>
            </p>
          )}
        </>
      )}
    </div>
  );
}
