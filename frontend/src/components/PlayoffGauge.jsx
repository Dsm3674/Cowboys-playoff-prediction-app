const { useEffect, useState, useRef } = React;

function PlayoffGauge({ teamCode = "DAL", year = new Date().getFullYear() }) {
  const [probability, setProbability] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    window.api
      .getPlayoffPulse(year)
      .then((data) => {
        if (!isMounted) return;
        const teamData = data.pulse.find((t) => t.code === teamCode);
        if (teamData) {
          setProbability(teamData.playoffProbability);
        } else {
          setProbability(0);
        }
      })
      .catch((err) => {
        console.error("Gauge fetch error:", err);
        if (isMounted) setProbability(0);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [teamCode, year]);

  useEffect(() => {
    if (loading || probability === null || !canvasRef.current) return;

    function renderChart() {
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext("2d");
      const style = getComputedStyle(document.body);

      // Read current themed colors
      const PRIMARY = style.getPropertyValue('--dak-navy').trim() || "#002244";
      const SECONDARY = style.getPropertyValue('--dak-silver').trim() || "#869397";
      const ACCENT = style.getPropertyValue('--accent').trim() || PRIMARY;
      const GAUGE_FILL = style.getPropertyValue('--gauge-fill').trim() || "rgba(255,255,255,0.08)";

      let accentColor = ACCENT;
      if (probability < 30) accentColor = SECONDARY;

      chartRef.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          datasets: [
            {
              data: [probability, 100 - probability],
              backgroundColor: [accentColor, GAUGE_FILL],
              borderWidth: 0,
              circumference: 180,
              rotation: 270,
              cutout: "82%",
              borderRadius: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          animation: {
            duration: 1200,
            easing: "easeOutQuart",
          },
        },
      });
    }

    renderChart();

    // Re-render chart if theme (body class) changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.attributeName === "class") {
          renderChart();
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
      observer.disconnect();
    };
  }, [probability, loading]);

  return (
    <div className="gauge-war-room">
      <div className="gauge-container">
        <canvas ref={canvasRef}></canvas>
        <div className="gauge-value-overlay">
          <span className="gauge-percent">{loading ? "..." : `${probability}%`}</span>
          <span className="gauge-label">Postseason Probability</span>
        </div>
        <div className="gauge-star">★</div>
      </div>
    </div>
  );
}

window.PlayoffGauge = PlayoffGauge;
