

class RosterArchitect {
    constructor() {
        this.SALARY_CAP = 224800000;
        this.UNIT_SCALE = 100000; // Normalizes cap for memory-efficient DP
        this.POSITION_REQUIREMENTS = {
            'QB': { min: 1, max: 2 },
            'RB': { min: 2, max: 4 },
            'WR': { min: 3, max: 6 },
            'TE': { min: 1, max: 3 },
            'OL': { min: 5, max: 8 },
            'DEF': { min: 1, max: 1 }
        };
    }

   
    async solve(playerPool) {
        console.log("[ARCHITECT] Optimizing Roster under constraints...");
        
        const W = Math.floor(this.SALARY_CAP / this.UNIT_SCALE);
        const n = playerPool.length;

        // DP state: dp[cost] = { tsi, roster, positions: { QB: 0... } }
        let dp = Array(W + 1).fill(null).map(() => ({
            tsi: 0,
            roster: [],
            positions: { QB: 0, RB: 0, WR: 0, TE: 0, OL: 0, DEF: 0 }
        }));

        // Optimization: Sort players by Efficiency (TSI per Dollar)
        const sortedPlayers = playerPool
            .map(p => ({
                ...p,
                efficiency: parseFloat(p.tsi) / (parseInt(p.current_salary) / 1000000),
                costUnits: Math.ceil(parseInt(p.current_salary) / this.UNIT_SCALE)
            }))
            .sort((a, b) => b.efficiency - a.efficiency);

        // Core DP Loop
        for (let i = 0; i < n; i++) {
            const player = sortedPlayers[i];
            const weight = player.costUnits;
            const value = parseFloat(player.tsi);

            // Backward iteration to prevent duplicate player selection
            for (let j = W; j >= weight; j--) {
                const prevState = dp[j - weight];
                
                // Constraint Verification
                if (this._isPositionallyLegal(prevState.positions, player.position)) {
                    const newTSI = prevState.tsi + value;

                    if (newTSI > dp[j].tsi) {
                        dp[j] = {
                            tsi: newTSI,
                            roster: [...prevState.roster, player.id],
                            positions: {
                                ...prevState.positions,
                                [player.position]: prevState.positions[player.position] + 1
                            }
                        };
                    }
                }
            }
        }

        // Extract the absolute best roster found
        const optimal = dp[W];
        return {
            summary: {
                totalTSI: optimal.tsi.toFixed(2),
                capUsed: optimal.roster.length > 0 ? this._calculateTotalCost(optimal.roster, playerPool) : 0,
                playerCount: optimal.roster.length
            },
            lineup: optimal.roster
        };
    }

    _isPositionallyLegal(currentPositions, newPos) {
        const limits = this.POSITION_REQUIREMENTS[newPos];
        if (!limits) return false;
        return currentPositions[newPos] < limits.max;
    }

    _calculateTotalCost(ids, pool) {
        return ids.reduce((sum, id) => {
            const p = pool.find(player => player.id === id);
            return sum + parseInt(p.current_salary);
        }, 0);
    }
}

module.exports = new RosterArchitect();
