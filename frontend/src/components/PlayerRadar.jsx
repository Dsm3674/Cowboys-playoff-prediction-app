function PlayerRadar() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);

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

  React.useEffect(() => {
    if (!data || !canvasRef.current || !window.Chart) return;

    // Cleanup old chart if rerendering
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvasRef.current.getContext("2d");
    const labels = data.labels || [];

    const palette = [
      {
        bg: "rgba(0, 53, 148, 0.25)",
        border: "rgba(0, 53, 148, 1)",
      },
      {
        bg: "rgba(255, 107, 53, 0.25)",
        border: "rgba(255, 107, 53, 1)",
      },
      {
        bg: "rgba(34, 197, 94, 0.25)",
        border: "rgba(34, 197, 94, 1)",
      },
    ];

    const datasets = (data.players || []).map((p, idx) => {
      const m = p.metrics || {};
      const vals = [
        m.offense || 0,
        m.explosiveness || 0,
        m.consistency || 0,
        m.clutch || 0,
        m.durability || 0,
      ];
      const colors = palette[idx % palette.length];

      return {
        label: p.name,
        data: vals,
        fill: true,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        pointBackgroundColor: colors.border,
        borderWidth: 2,
      };
    });

    chartRef.current = new window.Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            suggestedMin: 60,
            suggestedMax: 100,
            ticks: {
              stepSize: 10,
            },
            grid: {
              color: "rgba(148, 163, 184, 0.4)",
            },
            angleLines: {
              color: "rgba(148, 163, 184, 0.4)",
            },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return `${ctx.dataset.label}: ${ctx.formattedValue}`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  if (loading) {
    return (
      <div className="card">
        <h3>Player Impact Radar</h3>
        <p>Loading player impact...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Player Impact Radar</h3>
        <p style={{ color: "red" }}>Error: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const players = data.players || [];

  return (
    <div className="card">
      <h3>Player Impact Radar</h3>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        Visualize how Dak, CeeDee, and Micah shape win probability across
        offense, explosiveness, consistency, clutch, and durability.
      </p>

      <div style={{ height: 260, marginBottom: "0.75rem" }}>
        <canvas ref={canvasRef} />
      </div>

      {players.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            paddingLeft: 0,
            margin: 0,
            fontSize: "0.85rem",
            color: "#4b5563",
          }}
        >
          {players.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> &mdash; {p.position}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

