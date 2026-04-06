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

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    
    // Official Cowboys Colors
    const NAVY = "#002244";
    const SILVER = "#869397";
    const SILVER_LT = "#B0B7BC";
    const GREEN = "#10b981";
    const YELLOW = "#f59e0b";
    const RED = "#ef4444";

    let accentColor = SILVER;
    if (probability >= 80) accentColor = NAVY;
    else if (probability >= 50) accentColor = SILVER;
    else if (probability >= 30) accentColor = SILVER_LT;

    chartRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [probability, 100 - probability],
            backgroundColor: [accentColor, "rgba(255,255,255,0.08)"],
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
          duration: 1600,
          easing: "easeOutQuart",
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
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
