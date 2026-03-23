

const db = require('../databases');
const cache = require('../cache');

class FantasyEngine {
    constructor() {
        // Static baselines for VBD (Value Over Baseline)
        // Represents the TSI of a "Replacement Level" starter in a 12-team league.
        this.baselineTSI = {
            QB: 82.5,
            RB: 74.2,
            WR: 76.8,
            TE: 68.5,
            K: 60.0,
            DEF: 72.0
        };

        // Scarcity Weights: Higher means the position drops off faster in quality.
        // Used to detect "Cliffs" in talent availability.
        this.SCARCITY_WEIGHTS = {
            QB: 0.15,
            RB: 0.45, // RBs are historically the scarcest and most volatile.
            WR: 0.30,
            TE: 0.55, // Elite TEs provide the highest positional advantage.
            DEF: 0.05
        };

        this.DRAFT_BOARD_STATE = {
            remainingPlayers: [],
            pickedPlayers: [],
            currentRound: 1,
            teamNeeds: {}
        };
    }



    calculateDraftValue(player, boardContext = {}) {
        const baseline = this.baselineTSI[player.position] || 70;
        
        // 1. RAW VBD (Value Over Baseline)
        const vbdScore = player.tsi - baseline;

        // 2. SCARCITY ADJUSTMENT (VORP)
        // Measures how much the talent pool drops if you wait.
        const scarcityMod = this._calculateScarcityAdjustment(player.position, boardContext);

        // 3. RELIABILITY INDEX (Consistency + Clutch)
        // High TSI is useless if the player disappears in crucial games.
        const consistency = player.stats?.consistency || 70;
        const clutch = player.stats?.clutchIndex || 70;
        const reliability = (consistency * 0.6) + (clutch * 0.4);
        
        // 4. INJURY RISK PROPAGATION
        const riskFactor = this._calculateInjuryRisk(player);

        // 5. LEAGUE SCORING ADJUSTMENT
        const scoringAdj = this._applyLeagueSettings(player, boardContext.settings);

        // 6. FINAL AGGREGATE DVO
        const rawDVO = (vbdScore * (1 + scarcityMod)) * (reliability / 100) * scoringAdj;
        const finalDVO = rawDVO - (riskFactor * 8); // Heavy penalty for high-risk assets

        return {
            id: player.id,
            name: player.name,
            position: player.position,
            metrics: {
                vbd: parseFloat(vbdScore.toFixed(2)),
                dvo: parseFloat(finalDVO.toFixed(2)),
                scarcityImpact: (scarcityMod * 100).toFixed(1) + "%",
                riskFactor: riskFactor.toFixed(2),
                reliability: reliability.toFixed(1)
            },
            projections: {
                projectedPoints: (player.tsi * 1.85 * scoringAdj).toFixed(1),
                draftGrade: this._determineDraftGrade(finalDVO),
                floor: (player.tsi * 0.65).toFixed(1),
                ceiling: (player.tsi * 1.35).toFixed(1)
            },
            recommendation: this._generatePickRecommendation(player, finalDVO, riskFactor),
            dropOff: this._calculateDropOffRisk(player, boardContext)
        };
    }

  
    _calculateScarcityAdjustment(pos, context) {
        const weight = this.SCARCITY_WEIGHTS[pos] || 0.1;
        const remainingInTier = context.tiers?.[pos]?.remaining || 5;
        
        // Inverse relationship: Fewer remaining players = higher scarcity bonus.
        const scarcityBonus = (1 / Math.max(1, remainingInTier)) * weight * 10;
        return Math.min(0.6, scarcityBonus); // Cap at 60% scarcity premium.
    }

    _calculateInjuryRisk(player) {
        const age = player.age || 26;
        const usage = player.stats?.usageRate || 0.5;
        const history = player.history?.injuryCount || 0;
        
        let risk = 0.1; // Baseline risk
        if (age > 30) risk += 0.25;
        if (player.position === 'RB' && age > 28) risk += 0.2; // The "RB Age Cliff"
        if (usage > 0.85) risk += 0.3; // Heavy workload burnout
        if (history > 2) risk += 0.35;
        
        return Math.min(1.0, risk);
    }

    _applyLeagueSettings(player, settings = { ppr: 1.0, passTD: 4 }) {
        let mod = 1.0;
        if (player.position === 'WR' || player.position === 'TE') {
            mod += (settings.ppr - 1.0) * 0.12;
        }
        if (player.position === 'QB' && settings.passTD === 6) {
            mod += 0.15;
        }
        return mod;
    }

    _calculateDropOffRisk(player, context) {
        if (!context.board) return null;
        const posPool = context.board.filter(p => p.position === player.position && p.id !== player.id);
        const nextBest = posPool[0];
        
        if (!nextBest) return { pointsLost: player.tsi, severity: 'EXTREME' };
        
        const diff = player.tsi - nextBest.tsi;
        return {
            pointsLost: diff.toFixed(1),
            severity: diff > 10 ? 'HIGH' : diff > 5 ? 'MODERATE' : 'LOW'
        };
    }

    _determineDraftGrade(dvo) {
        if (dvo > 30) return 'S+ (Elite Value)';
        if (dvo > 20) return 'A (League Winner)';
        if (dvo > 10) return 'B (Solid Starter)';
        if (dvo > 0) return 'C (Replacement Level)';
        if (dvo > -10) return 'D (Reach)';
        return 'F (Bust Risk)';
    }

    _generatePickRecommendation(player, dvo, risk) {
        if (dvo > 25 && risk < 0.3) return "SMASH PICK: Massive value with elite safety.";
        if (dvo > 15 && risk > 0.7) return "BOOM/BUST: High ceiling, but extreme injury risk.";
        if (player.position === 'TE' && dvo > 10) return "POSITIONAL EDGE: Secure an elite TE before the cliff.";
        if (dvo < 0) return "AVOID: Better value exists at other positions.";
        return "SITUATIONAL: Draft based on roster needs.";
    }



    async generateOptimizedDraftBoard(playerPool, currentDraftedIds = [], settings = {}) {
        const available = playerPool.filter(p => !currentDraftedIds.includes(p.id));
        
        const context = {
            board: available,
            settings: settings,
            tiers: {
                QB: { remaining: available.filter(p => p.position === 'QB').length },
                RB: { remaining: available.filter(p => p.position === 'RB').length },
                WR: { remaining: available.filter(p => p.position === 'WR').length },
                TE: { remaining: available.filter(p => p.position === 'TE').length }
            }
        };

        const optimized = available
            .map(player => this.calculateDraftValue(player, context))
            .sort((a, b) => b.metrics.dvo - a.metrics.dvo);

        return {
            timestamp: new Date().toISOString(),
            topValuePicks: optimized.slice(0, 15),
            sleepers: optimized.filter(p => p.metrics.riskFactor < 0.4 && p.metrics.dvo > 5).slice(0, 5),
            cliffs: this._detectTalentCliffs(optimized)
        };
    }

    _detectTalentCliffs(board) {
        const cliffs = [];
        ['RB', 'WR', 'TE', 'QB'].forEach(pos => {
            const posPool = board.filter(p => p.position === pos);
            for (let i = 0; i < Math.min(posPool.length - 1, 5); i++) {
                const drop = posPool[i].metrics.dvo - posPool[i+1].metrics.dvo;
                if (drop > 8) {
                    cliffs.push({ position: pos, after: posPool[i].name, dropSeverity: drop.toFixed(1) });
                }
            }
        });
        return cliffs;
    }

    /**
     * AUTO-DRAFT PATH SIMULATOR
     * Uses a recursive look-ahead to find the best sequence of 3 picks.
     */
    simulateBestPath(teamRoster, playerPool, rounds = 3) {
        let currentRoster = [...teamRoster];
        let path = [];

        for (let r = 1; r <= rounds; r++) {
            const context = { tiers: this._getQuickTiers(playerPool, path) };
            const board = playerPool
                .filter(p => !path.map(pick => pick.id).includes(p.id))
                .map(p => this.calculateDraftValue(p, context));
            
            // Strategic Weighting: Boost DVO for positions not yet on roster.
            const pick = board.sort((a, b) => {
                const aNeed = currentRoster.some(p => p.position === a.position) ? 1.0 : 1.45;
                const bNeed = currentRoster.some(p => p.position === b.position) ? 1.0 : 1.45;
                return (b.metrics.dvo * bNeed) - (a.metrics.dvo * aNeed);
            })[0];

            path.push(pick);
            currentRoster.push(pick);
        }
        return path;
    }

    _getQuickTiers(pool, path) {
        const remaining = pool.filter(p => !path.map(x => x.id).includes(p.id));
        return {
            QB: { remaining: remaining.filter(p => p.position === 'QB').length },
            RB: { remaining: remaining.filter(p => p.position === 'RB').length },
            WR: { remaining: remaining.filter(p => p.position === 'WR').length },
            TE: { remaining: remaining.filter(p => p.position === 'TE').length }
        };
    }
}

module.exports = new FantasyEngine();
