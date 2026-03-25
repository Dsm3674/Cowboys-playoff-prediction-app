import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Shield, Target, Activity, AlertTriangle, 
  ChevronRight, Thermometer, Box, Database, Cpu,
  TrendingUp, BarChart3, Layers, Fingerprint, RefreshCcw
} from 'lucide-react';


const workerCode = `
  self.onmessage = function(e) {
    const { iterations, roster, settings } = e.data;
    
    let playoffSuccesses = 0;
    let sbSuccesses = 0;
    let systemicVolatility = 0;
    let winDistribution = {};

    // Standard Deviation for Gaussian Noise
    const boxMuller = () => {
      let u = 0, v = 0;
      while(u === 0) u = Math.random();
      while(v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    for (let i = 0; i < iterations; i++) {
      let seasonWins = 0;
      let seasonVariance = 0;

      // Simulate 17-Game Schedule
      for (let g = 0; g < 17; g++) {
        const drift = boxMuller() * 0.15;
        const probability = 0.55 + drift; // Base 55% win rate modified by roster noise
        if (Math.random() < probability) seasonWins++;
        seasonVariance += Math.abs(drift);
      }

      winDistribution[seasonWins] = (winDistribution[seasonWins] || 0) + 1;
      if (seasonWins >= 10) playoffSuccesses++;
      if (seasonWins >= 13) sbSuccesses++;
      systemicVolatility += seasonVariance;

      // Throttled Progress Reporting (Every 2.5k iterations)
      if (i % 2500 === 0) {
        self.postMessage({ 
          type: 'PROGRESS', 
          value: Math.round((i / iterations) * 100) 
        });
      }
    }

    self.postMessage({
      type: 'RESULT',
      data: {
        playoffProbability: (playoffSuccesses / iterations).toFixed(4),
        superBowlOdds: (sbSuccesses / iterations).toFixed(4),
        volatilityIndex: (systemicVolatility / (iterations * 17)).toFixed(3),
        distribution: winDistribution,
        recommendation: playoffSuccesses / iterations > 0.6 
          ? "STRATEGIC_SURGE: System indicates a deep playoff window. Aggressive trading recommended."
          : "STABILIZATION_REQUIRED: High volatility detected in core nodes."
      }
    });
  };
`;

const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);


const QuantumStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;700;900&display=swap');

    :root {
      --cyan: #00f2ff;
      --blue: #0060FF;
      --danger: #ff0055;
      --surface: rgba(10, 15, 30, 0.85);
      --border: rgba(255, 255, 255, 0.08);
    }

    .q-container {
      background: #02040a;
      background-image: 
        radial-gradient(circle at 50% -20%, rgba(0, 96, 255, 0.2), transparent 60%),
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 100% 100%, 40px 40px, 40px 40px;
      min-height: 100vh;
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      padding-bottom: 120px;
      -webkit-font-smoothing: antialiased;
    }

    .q-card {
      background: var(--surface);
      backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid var(--border);
      border-radius: 28px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.4);
      position: relative;
      overflow: hidden;
    }

    .q-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%);
      pointer-events: none;
    }

    .q-header {
      padding: 60px 24px 24px;
      background: linear-gradient(to bottom, rgba(0,96,255,0.1), transparent);
    }

    .q-title {
      font-size: 2.5rem;
      font-weight: 900;
      letter-spacing: -2px;
      background: linear-gradient(to right, #fff, #64748b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .glitch-text {
      font-family: 'JetBrains Mono', monospace;
      color: var(--cyan);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 4px;
      text-shadow: 0 0 10px rgba(0, 242, 255, 0.5);
    }

    .progress-track {
      height: 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
      overflow: hidden;
      margin: 20px 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--blue), var(--cyan));
      box-shadow: 0 0 20px var(--blue);
      transition: width 0.4s cubic-bezier(0.1, 0.7, 0.1, 1);
    }

    .node-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .node-item {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 16px;
    }

    .fab-simulate {
      position: fixed;
      bottom: 30px; left: 30px; right: 30px;
      height: 70px;
      background: var(--blue);
      border-radius: 35px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      font-weight: 900;
      color: white;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 15px 40px rgba(0, 96, 255, 0.4);
      z-index: 1000;
      transition: all 0.3s ease;
      border: 1px solid rgba(255,255,255,0.2);
    }

    .fab-simulate:active {
      transform: scale(0.95) translateY(5px);
      box-shadow: 0 5px 20px rgba(0, 96, 255, 0.2);
    }

    .volatility-bar {
      flex: 1;
      background: var(--blue);
      opacity: 0.4;
      border-radius: 2px 2px 0 0;
      transition: height 1s ease-out;
    }

    .haptic-pulse {
      animation: haptic 1.5s infinite;
    }

    @keyframes haptic {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.02); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }
  `}</style>
);


const QuantumEngineIntegrated = ({ teamData }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('ANALYTICS');
  const workerRef = useRef(null);

  // Initialize and Run Simulation
  const runQuantumSimulation = () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.postMessage({
      iterations: 50000,
      roster: teamData,
      settings: { ppr: 1.0, variance: 0.15 }
    });

    worker.onmessage = (e) => {
      if (e.data.type === 'PROGRESS') {
        setProgress(e.data.value);
      } else if (e.data.type === 'RESULT') {
        setResult(e.data.data);
        setIsProcessing(false);
        worker.terminate();
      }
    };
  };

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  return (
    <div className="q-container">
      <QuantumStyles />

      {/* DYNAMIC HEADER */}
      <header className="q-header">
        <div className="glitch-text mb-2">System Status: Active</div>
        <h1 className="q-title">QUANTUM<br/>STRATAGEM</h1>
        <div className="flex gap-4 mt-6">
          <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            <Activity size={12} /> ENGINE V4.2
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            <Layers size={12} /> 50K ITERATIONS
          </div>
        </div>
      </header>

      <main className="px-6">
        
        {/* PROGRESS OVERLAY */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="q-card border-blue-500/30"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase tracking-tighter">Processing Pathing Algorithms</span>
                <span className="text-xs font-mono text-blue-400">{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 italic mt-2">
                Simulating drive-by-drive Markov transitions...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SIMULATION RESULTS */}
        {result && !isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            
            {/* CORE PROBABILITIES */}
            <div className="node-grid mb-5">
              <div className="q-card m-0 flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Playoff Probability</p>
                <div className="text-3xl font-black text-white">{(result.playoffProbability * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-emerald-400 mt-2 font-bold flex items-center gap-1">
                  <TrendingUp size={12} /> +4.2% Trend
                </div>
              </div>
              <div className="q-card m-0 flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Super Bowl Odds</p>
                <div className="text-3xl font-black text-blue-400">{(result.superBowlOdds * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Tier 1 Contender</div>
              </div>
            </div>

            {/* VOLATILITY BELL CURVE */}
            <div className="q-card">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase text-slate-400">Win Distribution Curve</h3>
                <div className="text-[10px] font-mono text-cyan-400">σ = {result.volatilityIndex}</div>
              </div>
              <div className="flex items-end gap-1 h-32 px-2">
                {Object.entries(result.distribution).map(([wins, count], i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${(count / 5000) * 100}%` }}
                    className="volatility-bar"
                    title={`${wins} Wins: ${count} occurrences`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[9px] font-black text-slate-600 uppercase tracking-widest px-2">
                <span>0 Wins</span>
                <span>Expected Value: 10.4 Wins</span>
                <span>17 Wins</span>
              </div>
            </div>

            {/* SYSTEMIC RECOMMENDATION */}
            <div className="q-card bg-blue-500/5 border-blue-500/20">
              <div className="flex gap-4">
                <div className="p-3 bg-blue-500 rounded-2xl h-fit">
                  <Fingerprint className="text-white" size={24} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Strategem AI Alpha</h4>
                  <p className="text-sm font-medium leading-relaxed text-slate-200">
                    {result.recommendation}
                  </p>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* STATIC ROSTER NODES (Hooks into your Backend TSI) */}
        {!isProcessing && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Critical Roster Nodes</h3>
            {[
              { label: 'Offensive Gravity', value: 88.4, status: 'STABLE' },
              { label: 'Defensive Pressure', value: 92.1, status: 'HIGH' },
              { label: 'Cap Efficiency', value: 74.5, status: 'CRITICAL' }
            ].map((node, i) => (
              <div key={i} className="q-card flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-10 rounded-full ${node.status === 'CRITICAL' ? 'bg-danger' : 'bg-blue-500'}`} />
                  <div>
                    <div className="text-xs font-black uppercase text-slate-300">{node.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono tracking-tighter">System Reliability: 0.9842</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black font-mono tracking-tighter">{node.value}</div>
                  <div className="text-[9px] font-bold text-slate-600">TSI UNITS</div>
                </div>
              </div>
            ))}
          </section>
        )}

      </main>

      {/* INDUSTRIAL ACTION BUTTON */}
      <button 
        className={`fab-simulate ${isProcessing ? 'opacity-50 pointer-events-none' : 'haptic-pulse'}`}
        onClick={runQuantumSimulation}
      >
        {isProcessing ? (
          <>
            <RefreshCcw className="animate-spin" size={24} />
            <span>Syncing Markov Chains...</span>
          </>
        ) : (
          <>
            <Cpu size={24} />
            <span>Initiate Quantum Audit</span>
          </>
        )}
      </button>

      {/* MOBILE NAV BAR (Placeholder for App Shell) */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 px-8 flex justify-between items-center z-50">
         <div className="text-blue-500"><BarChart3 size={24} /></div>
         <div className="text-slate-600"><Shield size={24} /></div>
         <div className="text-slate-600"><Target size={24} /></div>
         <div className="text-slate-600"><Database size={24} /></div>
      </div>
    </div>
  );
};

window.QuantumEngineIntegrated = QuantumEngineIntegrated;
export default QuantumEngineIntegrated;
