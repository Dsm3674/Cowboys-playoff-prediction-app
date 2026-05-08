
const db = require('../databases');
const cache = require('../cache');

class RosterImpactMatrix {
    constructor() {
      
        this.PROPAGATION_NODES = {
            'QB': { 
                dependents: ['WR', 'TE', 'RB'], 
                gravity: 0.65 // If QB fails, teammates lose up to 65% of their ceiling
            },
            'OL': { 
                dependents: ['QB', 'RB'], 
                gravity: 0.45 
            },
            'CB1': { 
                dependents: ['SAF', 'CB2'], 
                gravity: 0.25 
            },
            'EDGE': { 
                dependents: ['CB', 'LB'], 
                gravity: 0.30 
            }
        };

        this.SYNERGY_COEFFICIENTS = {
            'QB_WR_TENURE': 0.08, // 8% boost for 3+ years together
            'OL_UNIT_COHESION': 0.12, // 12% boost for static starting 5
            'DL_ROTATION_DEPTH': 0.05
        };
    }

 
    async simulateSystemicCollapse(targetPlayerId, currentRoster) {
        const target = currentRoster.find(p => p.id === targetPlayerId);
        if (!target) return null;

        console.log(`[STRESS_TEST] Simulating failure of Linchpin: ${target.name}`);

        // 1. Initial Loss (The player's own TSI)
        let totalSystemLoss = target.tsi;
        let rippleLog = [];

        // 2. PRIMARY RIPPLE (Direct dependencies)
        const primaryDependents = this.PROPAGATION_NODES[target.position]?.dependents || [];
        
        currentRoster.forEach(teammate => {
            if (teammate.id === target.id) return;

            if (primaryDependents.includes(teammate.position)) {
                const impact = this._calculateDirectImpact(target, teammate);
                totalSystemLoss += impact;
                rippleLog.push({
                    affected: teammate.name,
                    loss: impact.toFixed(2),
                    tier: 'PRIMARY'
                });

                // 3. SECONDARY RIPPLE (Recursive Failure)
                // If QB is impacted by OL injury, the WRs are then impacted by the QB's degradation
                const secondaryLoss = this._calculateSecondaryRipple(teammate, currentRoster, impact);
                totalSystemLoss += secondaryLoss;
            }
        });

        return {
            linchpin: target.name,
            totalImpactScore: totalSystemLoss.toFixed(2),
            fragilityRating: this._getFragilityLabel(totalSystemLoss, target.tsi),
            ripples: rippleLog,
            replacementUrgency: totalSystemLoss > 100 ? 'CRITICAL' : 'MODERATE'
        };
    }

 
    _calculateSecondaryRipple(affectedPlayer, roster, initialLoss) {
        let secondaryTotal = 0;
        const subDependents = this.PROPAGATION_NODES[affectedPlayer.position]?.dependents || [];

        if (subDependents.length === 0) return 0;

        roster.forEach(p => {
            if (subDependents.includes(p.position)) {
                // Secondary loss is 40% of the primary loss intensity
                const loss = (initialLoss * 0.4);
                secondaryTotal += loss;
            }
        });

        return secondaryTotal;
    }

    calculateForceMultiplier(player, teammates) {
        let synergyBonus = 0;

        teammates.forEach(tm => {
            // Check for QB-WR Tenure (The "Dak-CeeDee" effect)
            if (player.position === 'QB' && tm.position === 'WR') {
                if (player.years_with_team >= 3 && tm.years_with_team >= 3) {
                    synergyBonus += (tm.tsi * this.SYNERGY_COEFFICIENTS.QB_WR_TENURE);
                }
            }

            // Check for OL Unit Cohesion
            if (player.position === 'OL' && tm.position === 'OL') {
                synergyBonus += (tm.tsi * this.SYNERGY_COEFFICIENTS.OL_UNIT_COHESION / 4);
            }
        });

        return {
            rawTsi: player.tsi,
            synergyValue: synergyBonus.toFixed(2),
            totalSystemValue: (player.tsi + synergyBonus).toFixed(2)
        };
    }

   
    async findRosterLinchpins(roster) {
        const results = await Promise.all(
            roster.map(p => this.simulateSystemicCollapse(p.id, roster))
        );

        return results
            .sort((a, b) => b.totalImpactScore - a.totalImpactScore)
            .slice(0, 5)
            .map(r => ({
                player: r.linchpin,
                dangerZone: r.totalImpactScore,
                description: `${r.linchpin} accounts for ${r.totalImpactScore} units of systemic value.`
            }));
    }

    _calculateDirectImpact(source, target) {
        const gravity = this.PROPAGATION_NODES[source.position]?.gravity || 0.1;
        // Formula: Impact = Target TSI * Gravity * (Source TSI / 100)
        return target.tsi * gravity * (source.tsi / 100);
    }

    _getFragilityLabel(loss, individualTsi) {
        const ratio = loss / individualTsi;
        if (ratio > 2.5) return 'SYSTEM_CRITICAL_ASSET';
        if (ratio > 1.8) return 'HIGH_DEPENDENCY_NODE';
        return 'STANDARD_CONTRIBUTOR';
    }

  
    evaluateTradeFit(incomingPlayer, currentRoster) {
        const synergy = this.calculateForceMultiplier(incomingPlayer, currentRoster);
        const baseline = incomingPlayer.tsi;
        
        const fitScore = (synergy.totalSystemValue / baseline) * 100;

        return {
            name: incomingPlayer.name,
            fitScore: fitScore.toFixed(1) + "%",
            isForceMultiplier: fitScore > 110,
            commentary: fitScore > 110 
                ? "Elite Schematic Fit: Player amplifies existing roster talent."
                : "Neutral Fit: Player provides individual stats only."
        };
    }
}

module.exports = new RosterImpactMatrix();
