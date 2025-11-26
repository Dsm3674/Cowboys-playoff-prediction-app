function PlayerRadar() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  // Visibility toggles
  const [visible, setVisible] = React.useState({
    dak: true,
    ceedee: true,
    micah: true,
  });

  // Load radar data from backend
  React.useEffect(() => {
    const BASE =
      window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : window.location.origin;

    fetch(`${BASE}/api/players/radar`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load player radar");
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Render radar chart
  React.useEffect(() => {
    if (!data || !canvasRef.current) return;

    // destroy old chart
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const players = data.players || [];
    const labels = data.labels || [];
    const ctx = canvasRef.current.getContext("2d");

    const colors = {
      dak: { bg: "rgba(0,53,148,0.25)", border: "#003594" },
      ceedee: { bg: "rgba(255,107,53,0.25)", border: "#ff6b35" },
      micah: { bg: "rgba(34,197,94,0.25)", border: "#22c55e" },
    };

    const datasets = players.map((p) => {
      const id = p.name.toLowerCase().includes("prescott")
        ? "dak"
        : p.name.toLowerCase().includes("lamb")
        ? "ceedee"
        : "micah";

      const stats = p.metrics || {};
      return {
        label: p.name,
        data: [
          stats.offense,
          stats.explosiveness,
          stats.consistency,
          stats.clutch,
          stats.durability,
        ],
        fill: true,
        borderWidth: 2,
        hidden: !visible[id],
        backgroundColor: colors[id].bg,
        borderColor: colors[id].border,
        pointBackgroundColor: colors[id].border,
      };
    });

    chartRef.current = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: "easeOutQuart",
        },
        scales: {
          r: {
            suggestedMin: 60,
            suggestedMax: 100,
            grid: {
              color:
                getComputedStyle(document.body).getPropertyValue(
                  "--border-subtle"
                ) || "rgba(148,163,184,0.4)",
            },
            angleLines: {
              color:
                getComputedStyle(document.body).getPropertyValue(
                  "--border-subtle"
                ) || "rgba(148,163,184,0.4)",
            },
            pointLabels: {
              color:
                getComputedStyle(document.body).getPropertyValue("--text-main"),
              font: { size: 12, weight: "bold" },
            },
          },
        },
        plugins: { legend: { display: false } },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data, visible]);

  const togglePlayer = (id) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Loading states
  if (loading) {
    return (
      <div className="card fade-in">
        <h3>Player Impact Radar</h3>
        <p>Loading your chart...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card fade-in">
        <h3>Player Impact Radar</h3>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  const players = data.players || [];

  return (
    <div className="card fade-in pulse-glow">
      <h3>Player Impact Radar</h3>
      <p className="eyebrow">Dak • CeeDee • Micah</p>

      {/* Player toggle buttons */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn-primary"
          style={{
            flex: 1,
            background: "#003594",
            opacity: visible.dak ? 1 : 0.4,
          }}
          onClick={() => togglePlayer("dak")}
        >
          Dak Prescott
        </button>

        <button
          className="btn-primary"
          style={{
            flex: 1,
            background: "#ff6b35",
            opacity: visible.ceedee ? 1 : 0.4,
          }}
          onClick={() => togglePlayer("ceedee")}
        >
          CeeDee Lamb
        </button>

        <button
          className="btn-primary"
          style={{
            flex: 1,
            background: "#22c55e",
            opacity: visible.micah ? 1 : 0.4,
          }}
          onClick={() => togglePlayer("micah")}
        >
          Micah Parsons
        </button>
      </div>

      {/* Radar canvas */}
      <div style={{ height: 300, marginBottom: "1rem" }}>
        <canvas ref={canvasRef} />
      </div>

      {/* Metric Explanation */}
      <h4>What These Metrics Mean</h4>
      <ul
        style={{
          fontSize: "0.9rem",
          lineHeight: "1.45",
          marginBottom: "1rem",
          paddingLeft: "1rem",
        }}
      >
        <li>
          <strong>Offense</strong> – Drive impact, scoring production.
        </li>
        <li>
          <strong>Explosiveness</strong> – Big-play creation ability.
        </li>
        <li>
          <strong>Consistency</strong> – Week-to-week reliability.
        </li>
        <li>
          <strong>Clutch</strong> – High-stakes performance.
        </li>
        <li>
          <strong>Durability</strong> – Availability & injury resistance.
        </li>
      </ul>

      {/* Player List */}
      <h4>Players Analyzed</h4>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {players.map((p, i) => (
          <li key={i} style={{ marginBottom: "0.4rem" }}>
            <strong>{p.name}</strong> — {p.position}
          </li>
        ))}
      </ul>
    </div>
  );
}

