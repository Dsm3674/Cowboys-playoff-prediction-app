function QuantumEngineIntegrated({ teamData = {} }) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [preset, setPreset] = React.useState("balanced");
  const [iterations, setIterations] = React.useState(50000);
  const [baseWinRate, setBaseWinRate] = React.useState(0.55);
  const [variance, setVariance] = React.useState(0.15);
  const [scheduleWeight, setScheduleWeight] = React.useState(0.0);
  const [injuryPenalty, setInjuryPenalty] = React.useState(0.0);
  const [message, setMessage] = React.useState("Ready to simulate.");
  const workerRef = React.useRef(null);
  const workerUrlRef = React.useRef(null);

  const presets = {
    balanced: {
      label: "Balanced",
      baseWinRate: 0.55,
      variance: 0.15,
      scheduleWeight: 0.0,
      injuryPenalty: 0.0,
    },
    optimistic: {
      label: "Optimistic",
      baseWinRate: 0.62,
      variance: 0.12,
      scheduleWeight: 0.03,
      injuryPenalty: 0.0,
    },
    conservative: {
      label: "Conservative",
      baseWinRate: 0.5,
      variance: 0.13,
      scheduleWeight: -0.02,
      injuryPenalty: -0.02,
    },
    injuryCrisis: {
      label: "Injury Crisis",
      baseWinRate: 0.48,
      variance: 0.19,
      scheduleWeight: -0.01,
      injuryPenalty: -0.06,
    },
    softSchedule: {
      label: "Soft Schedule",
      baseWinRate: 0.58,
      variance: 0.14,
      scheduleWeight: 0.05,
      injuryPenalty: 0.0,
    },
  };

  const applyPreset = (name) => {
    const selected = presets[name];
    if (!selected) return;
    setPreset(name);
    setBaseWinRate(selected.baseWinRate);
    setVariance(selected.variance);
    setScheduleWeight(selected.scheduleWeight);
    setInjuryPenalty(selected.injuryPenalty);
    setMessage(`Preset applied: ${selected.label}`);
  };

  const workerCode = `
    self.onmessage = function (e) {
      const { iterations, baseWinRate, variance, scheduleWeight, injuryPenalty } = e.data;

      let playoffSuccesses = 0;
      let superBowlSuccesses = 0;
      let totalWins = 0;
      let systemicVolatility = 0;
      let winDistribution = {};
      let bestCase = 0;
      let worstCase = 17;
      let deepRunCount = 0;

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

      const boxMuller = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      };

      for (let i = 0; i < iterations; i++) {
        let seasonWins = 0;
        let seasonVariance = 0;

        for (let g = 0; g < 17; g++) {
          const weeklyScheduleSwing = Math.sin((g + 1) / 2.8) * scheduleWeight;
          const randomDrift = boxMuller() * variance;
          const probability = clamp(
            baseWinRate + weeklyScheduleSwing + injuryPenalty + randomDrift,
            0.05,
            0.95
          );

          if (Math.random() < probability) seasonWins++;
          seasonVariance += Math.abs(randomDrift);
        }

        totalWins += seasonWins;
        bestCase = Math.max(bestCase, seasonWins);
        worstCase = Math.min(worstCase, seasonWins);

        winDistribution[seasonWins] = (winDistribution[seasonWins] || 0) + 1;

        if (seasonWins >= 10) playoffSuccesses++;
        if (seasonWins >= 12) deepRunCount++;
        if (seasonWins >= 13) superBowlSuccesses++;

        systemicVolatility += seasonVariance;

        if (i % 2500 === 0) {
          self.postMessage({
            type: "PROGRESS",
            value: Math.round((i / iterations) * 100)
          });
        }
      }

      const averageWins = totalWins / iterations;
      const playoffProbability = playoffSuccesses / iterations;
      const superBowlOdds = superBowlSuccesses / iterations;
      const deepRunProbability = deepRunCount / iterations;
      const volatilityIndex = systemicVolatility / (iterations * 17);

      let recommendation = "Hold current posture.";
      if (playoffProbability > 0.72) {
        recommendation = "Strategic surge: model shows a strong playoff window. Aggressive roster moves are justified.";
      } else if (playoffProbability > 0.58) {
        recommendation = "Competitive window open: targeted upgrades could materially improve the ceiling.";
      } else if (playoffProbability > 0.42) {
        recommendation = "Borderline contender: outcomes are highly sensitive to variance and injuries.";
      } else {
        recommendation = "Stabilization required: current profile suggests too much downside risk for a deep run.";
      }

      self.postMessage({
        type: "RESULT",
        data: {
          playoffProbability,
          superBowlOdds,
          deepRunProbability,
          averageWins,
          volatilityIndex,
          bestCase,
          worstCase,
          distribution: winDistribution,
          recommendation
        }
      });
    };
  `;

  const cleanupWorker = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (workerUrlRef.current) {
      URL.revokeObjectURL(workerUrlRef.current);
      workerUrlRef.current = null;
    }
  };

  const runQuantumSimulation = () => {
    if (isProcessing) return;

    cleanupWorker();
    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    setMessage("Running simulation...");

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    workerUrlRef.current = workerUrl;

    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.postMessage({
      iterations,
      roster: teamData,
      baseWinRate,
      variance,
      scheduleWeight,
      injuryPenalty,
    });

    worker.onmessage = (e) => {
      if (e.data.type === "PROGRESS") {
        setProgress(e.data.value);
        setMessage("Crunching thousands of season paths...");
      } else if (e.data.type === "RESULT") {
        setResult(e.data.data);
        setIsProcessing(false);
        setProgress(100);
        setMessage("Simulation complete.");
        cleanupWorker();
      }
    };

    worker.onerror = () => {
      setIsProcessing(false);
      setMessage("Simulation failed. Check the component code.");
      cleanupWorker();
    };
  };

  React.useEffect(() => {
    return () => cleanupWorker();
  }, []);

  const distributionEntries = result
    ? Object.entries(result.distribution)
        .map(([wins, count]) => ({ wins: Number(wins), count }))
        .sort((a, b) => a.wins - b.wins)
    : [];

  const maxCount = distributionEntries.length
    ? Math.max(...distributionEntries.map((item) => item.count))
    : 1;

  const metricCardStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    padding: "18px",
    minWidth: 0,
  };

  const labelStyle = {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(229,238,252,0.62)",
    marginBottom: "8px",
  };

  const valueStyle = {
    fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
    fontWeight: 800,
    lineHeight: 1,
  };

  return (
    <div
      style={{
        minHeight: "70vh",
        background: "linear-gradient(180deg, #020817 0%, #081226 100%)",
        color: "#e5eefc",
        borderRadius: "20px",
        padding: "24px",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "#7dd3fc",
            marginBottom: "10px",
          }}
        >
          System Status: Active
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            lineHeight: 1,
            fontWeight: 900,
          }}
        >
          Quantum Stratagem
        </h1>

        <p
          style={{
            color: "rgba(229,238,252,0.72)",
            marginTop: "12px",
            marginBottom: "8px",
          }}
        >
          High-volume season simulation with volatility scoring, distribution analysis,
          and playoff outlook.
        </p>

        <div
          style={{
            fontSize: "13px",
            color: "rgba(125,211,252,0.88)",
          }}
        >
          {message}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div style={metricCardStyle}>
          <div style={labelStyle}>Preset</div>
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f172a",
              color: "#e5eefc",
            }}
          >
            {Object.entries(presets).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        <div style={metricCardStyle}>
          <div style={labelStyle}>Iterations</div>
          <input
            type="number"
            min="5000"
            step="5000"
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value) || 50000)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f172a",
              color: "#e5eefc",
            }}
          />
        </div>

        <div style={metricCardStyle}>
          <div style={labelStyle}>Base Win Rate</div>
          <input
            type="range"
            min="0.35"
            max="0.75"
            step="0.01"
            value={baseWinRate}
            onChange={(e) => setBaseWinRate(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: "8px", color: "#93c5fd" }}>
            {(baseWinRate * 100).toFixed(1)}%
          </div>
        </div>

        <div style={metricCardStyle}>
          <div style={labelStyle}>Variance</div>
          <input
            type="range"
            min="0.05"
            max="0.3"
            step="0.01"
            value={variance}
            onChange={(e) => setVariance(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: "8px", color: "#93c5fd" }}>
            {variance.toFixed(2)}
          </div>
        </div>

        <div style={metricCardStyle}>
          <div style={labelStyle}>Schedule Modifier</div>
          <input
            type="range"
            min="-0.08"
            max="0.08"
            step="0.01"
            value={scheduleWeight}
            onChange={(e) => setScheduleWeight(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: "8px", color: "#93c5fd" }}>
            {scheduleWeight >= 0 ? "+" : ""}
            {scheduleWeight.toFixed(2)}
          </div>
        </div>

        <div style={metricCardStyle}>
          <div style={labelStyle}>Injury Penalty</div>
          <input
            type="range"
            min="-0.12"
            max="0.03"
            step="0.01"
            value={injuryPenalty}
            onChange={(e) => setInjuryPenalty(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ marginTop: "8px", color: "#93c5fd" }}>
            {injuryPenalty >= 0 ? "+" : ""}
            {injuryPenalty.toFixed(2)}
          </div>
        </div>
      </div>

      {isProcessing && (
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "10px",
              flexWrap: "wrap",
            }}
          >
            <strong>Processing simulation</strong>
            <span>{progress}%</span>
          </div>

          <div
            style={{
              width: "100%",
              height: "10px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #2563eb, #22d3ee)",
                transition: "width 0.25s ease",
              }}
            />
          </div>

          <p style={{ marginBottom: 0, marginTop: "10px", color: "rgba(229,238,252,0.66)" }}>
            Simulating weekly variance, schedule pressure, and injury-adjusted outcomes.
          </p>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={runQuantumSimulation}
          disabled={isProcessing}
          style={{
            border: "none",
            borderRadius: "14px",
            padding: "14px 18px",
            fontWeight: 800,
            cursor: isProcessing ? "not-allowed" : "pointer",
            background: isProcessing
              ? "rgba(37,99,235,0.45)"
              : "linear-gradient(90deg, #2563eb, #0ea5e9)",
            color: "#fff",
            boxShadow: "0 10px 22px rgba(37,99,235,0.25)",
            width: "100%",
            maxWidth: "320px",
          }}
        >
          {isProcessing ? "Running Simulation..." : "Initiate Quantum Audit"}
        </button>
      </div>

      {result && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <div style={metricCardStyle}>
              <div style={labelStyle}>Playoff Probability</div>
              <div style={valueStyle}>{(result.playoffProbability * 100).toFixed(1)}%</div>
            </div>

            <div style={metricCardStyle}>
              <div style={labelStyle}>Super Bowl Odds</div>
              <div style={valueStyle}>{(result.superBowlOdds * 100).toFixed(1)}%</div>
            </div>

            <div style={metricCardStyle}>
              <div style={labelStyle}>Deep Run Probability</div>
              <div style={valueStyle}>{(result.deepRunProbability * 100).toFixed(1)}%</div>
            </div>

            <div style={metricCardStyle}>
              <div style={labelStyle}>Average Wins</div>
              <div style={valueStyle}>{result.averageWins.toFixed(2)}</div>
            </div>

            <div style={metricCardStyle}>
              <div style={labelStyle}>Volatility Index</div>
              <div style={valueStyle}>{result.volatilityIndex.toFixed(3)}</div>
            </div>

            <div style={metricCardStyle}>
              <div style={labelStyle}>Range</div>
              <div style={valueStyle}>
                {result.worstCase}–{result.bestCase}
              </div>
            </div>
          </div>

          <div
            style={{
              ...metricCardStyle,
              marginBottom: "20px",
            }}
          >
            <div style={labelStyle}>Recommendation</div>
            <div style={{ fontSize: "15px", lineHeight: 1.6, color: "#dbeafe" }}>
              {result.recommendation}
            </div>
          </div>

          <div
            style={{
              ...metricCardStyle,
              marginBottom: "20px",
            }}
          >
            <div style={labelStyle}>Win Distribution</div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "6px",
                height: "220px",
                overflowX: "auto",
                padding: "10px 0",
              }}
            >
              {distributionEntries.map((item) => (
                <div
                  key={item.wins}
                  style={{
                    minWidth: "28px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    title={`${item.wins} wins: ${item.count} seasons`}
                    style={{
                      width: "100%",
                      height: `${Math.max(8, (item.count / maxCount) * 160)}px`,
                      background: "linear-gradient(180deg, #38bdf8, #2563eb)",
                      borderRadius: "8px 8px 0 0",
                    }}
                  />
                  <div style={{ fontSize: "11px", color: "rgba(229,238,252,0.72)" }}>
                    {item.wins}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "12px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
              }}
            >
              <div style={{ color: "rgba(229,238,252,0.72)" }}>
                Most of the probability mass should cluster around the projected win band.
              </div>
              <div style={{ color: "rgba(229,238,252,0.72)" }}>
                Higher variance widens the distribution and raises both upside and downside.
              </div>
            </div>
          </div>

          <div
            style={{
              ...metricCardStyle,
            }}
          >
            <div style={labelStyle}>Roster Signals</div>

            {[
              {
                label: "Offensive Gravity",
                value: (baseWinRate * 100 + 28).toFixed(1),
                status: baseWinRate > 0.57 ? "STABLE" : "WATCH",
              },
              {
                label: "Schedule Pressure",
                value: (50 + scheduleWeight * 300).toFixed(1),
                status: scheduleWeight >= 0 ? "FAVORABLE" : "TOUGH",
              },
              {
                label: "Injury Exposure",
                value: (60 + Math.abs(injuryPenalty) * 260).toFixed(1),
                status: injuryPenalty < -0.04 ? "CRITICAL" : "MANAGEABLE",
              },
            ].map((node, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  padding: "14px 0",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{node.label}</div>
                  <div style={{ color: "rgba(229,238,252,0.62)", fontSize: "13px", marginTop: "4px" }}>
                    Status: {node.status}
                  </div>
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#7dd3fc" }}>
                  {node.value}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

window.QuantumEngineIntegrated = QuantumEngineIntegrated;
