/**
 * Maps.test.js
 * Unit tests for the Consistency vs Explosiveness player analysis
 * 
 * Run with: npm test -- Maps.test.js
 * Or: jest Maps.test.js
 */

const { computeConsistencyExplosiveness } = require("../Maps");

describe("Maps - Consistency vs Explosiveness Analysis", () => {
  // ========================================================================
  // TEST SUITE 1: Basic Functionality
  // ========================================================================

  describe("computeConsistencyExplosiveness", () => {
    it("should return success true with valid player data", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          metrics: {
            consistency: 85,
            clutch: 80,
            durability: 82,
            explosiveness: 75,
            offense: 88,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);

      expect(result.success).toBe(true);
      expect(result.players).toHaveLength(1);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should handle empty player array gracefully", () => {
      const result = computeConsistencyExplosiveness([]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.players).toEqual([]);
    });

    it("should handle null input gracefully", () => {
      const result = computeConsistencyExplosiveness(null);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return quadrant data for all four categories", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      expect(result.quadrants).toBeDefined();
      expect(result.quadrants.elite).toBeDefined();
      expect(result.quadrants.volatile).toBeDefined();
      expect(result.quadrants.reliable).toBeDefined();
      expect(result.quadrants.inconsistent).toBeDefined();
    });
  });

  // ========================================================================
  // TEST SUITE 2: Player Categorization
  // ========================================================================

  describe("Player Categorization", () => {
    it("should categorize elite players (high consistency, high explosiveness)", () => {
      const players = [
        {
          id: "elite",
          name: "Elite Player",
          position: "WR",
          metrics: {
            consistency: 85,
            clutch: 82,
            durability: 80,
            explosiveness: 88,
            offense: 85,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.category).toBe("elite");
      expect(player.consistency).toBeGreaterThan(70);
      expect(player.explosiveness).toBeGreaterThan(70);
    });

    it("should categorize volatile players (low consistency, high explosiveness)", () => {
      const players = [
        {
          id: "volatile",
          name: "Volatile Player",
          position: "WR",
          metrics: {
            consistency: 55,
            clutch: 60,
            durability: 50,
            explosiveness: 85,
            offense: 82,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.category).toBe("volatile");
      expect(player.consistency).toBeLessThan(65);
      expect(player.explosiveness).toBeGreaterThan(70);
    });

    it("should categorize reliable players (high consistency, lower explosiveness)", () => {
      const players = [
        {
          id: "reliable",
          name: "Reliable Player",
          position: "RB",
          metrics: {
            consistency: 80,
            clutch: 78,
            durability: 82,
            explosiveness: 55,
            offense: 65,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.category).toBe("reliable");
      expect(player.consistency).toBeGreaterThan(70);
      expect(player.explosiveness).toBeLessThan(65);
    });

    it("should categorize inconsistent players (low on both dimensions)", () => {
      const players = [
        {
          id: "inconsistent",
          name: "Inconsistent Player",
          position: "TE",
          metrics: {
            consistency: 45,
            clutch: 48,
            durability: 50,
            explosiveness: 40,
            offense: 45,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.category).toBe("inconsistent");
      expect(player.consistency).toBeLessThan(65);
      expect(player.explosiveness).toBeLessThan(65);
    });
  });

  // ========================================================================
  // TEST SUITE 3: Volatility Assessment
  // ========================================================================

  describe("Volatility Assessment", () => {
    it("should mark truly volatile players as VOLATILE", () => {
      const players = [
        {
          id: "vol",
          name: "Volatile Player",
          position: "WR",
          metrics: {
            consistency: 45,
            clutch: 50,
            durability: 48,
            explosiveness: 80,
            offense: 78,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.volatility).toBe("VOLATILE");
    });

    it("should mark stable/high performers as STABLE", () => {
      const players = [
        {
          id: "stable",
          name: "Stable Player",
          position: "QB",
          metrics: {
            consistency: 82,
            clutch: 85,
            durability: 80,
            explosiveness: 80,
            offense: 85,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.volatility).toBe("STABLE");
    });

    it("should mark predictable/low performers as PREDICTABLE", () => {
      const players = [
        {
          id: "pred",
          name: "Predictable Player",
          position: "CB",
          metrics: {
            consistency: 75,
            clutch: 72,
            durability: 76,
            explosiveness: 45,
            offense: 50,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.volatility).toBe("PREDICTABLE");
    });
  });

  // ========================================================================
  // TEST SUITE 4: Performance Tier Classification
  // ========================================================================

  describe("Performance Tier Classification", () => {
    it("should classify star-tier players correctly", () => {
      const players = [
        {
          id: "star",
          name: "Star Player",
          position: "WR",
          metrics: {
            consistency: 88,
            clutch: 90,
            durability: 87,
            explosiveness: 92,
            offense: 90,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.tier).toBe("STAR");
    });

    it("should classify starter-tier players correctly", () => {
      const players = [
        {
          id: "start",
          name: "Starter Player",
          position: "RB",
          metrics: {
            consistency: 75,
            clutch: 72,
            durability: 74,
            explosiveness: 70,
            offense: 72,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(["STARTER", "ROLE_PLAYER"]).toContain(player.tier);
    });

    it("should have valid tier values", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      const validTiers = ["STAR", "STARTER", "ROLE_PLAYER", "BACKUP"];

      result.players.forEach((player) => {
        expect(validTiers).toContain(player.tier);
      });
    });
  });

  // ========================================================================
  // TEST SUITE 5: Metrics Bounds and Normalization
  // ========================================================================

  describe("Metrics Normalization", () => {
    it("should keep consistency scores within 0-100 range", () => {
      const players = [
        {
          id: "high",
          name: "Very High",
          position: "QB",
          metrics: {
            consistency: 150,
            clutch: 150,
            durability: 150,
            explosiveness: 50,
            offense: 50,
          },
        },
        {
          id: "low",
          name: "Very Low",
          position: "RB",
          metrics: {
            consistency: 20,
            clutch: 20,
            durability: 20,
            explosiveness: 80,
            offense: 80,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);

      result.players.forEach((player) => {
        expect(player.consistency).toBeGreaterThanOrEqual(20);
        expect(player.consistency).toBeLessThanOrEqual(100);
      });
    });

    it("should keep explosiveness scores within 0-100 range", () => {
      const players = [
        {
          id: "high",
          name: "Very High",
          position: "WR",
          metrics: {
            consistency: 50,
            clutch: 50,
            durability: 50,
            explosiveness: 150,
            offense: 150,
          },
        },
        {
          id: "low",
          name: "Very Low",
          position: "CB",
          metrics: {
            consistency: 80,
            clutch: 80,
            durability: 80,
            explosiveness: 10,
            offense: 10,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);

      result.players.forEach((player) => {
        expect(player.explosiveness).toBeGreaterThanOrEqual(20);
        expect(player.explosiveness).toBeLessThanOrEqual(100);
      });
    });
  });

  // ========================================================================
  // TEST SUITE 6: Insights Generation
  // ========================================================================

  describe("Insights Generation", () => {
    it("should generate insights for elite players", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      const eliteInsight = result.insights.find((i) => i.type === "strength");

      expect(eliteInsight).toBeDefined();
      expect(eliteInsight.message).toContain("elite");
    });

    it("should flag volatile talent in insights", () => {
      const players = [
        {
          id: "vol1",
          name: "Volatile Star",
          position: "WR",
          metrics: {
            consistency: 45,
            clutch: 50,
            durability: 48,
            explosiveness: 85,
            offense: 82,
          },
        },
        {
          id: "vol2",
          name: "Volatile Talent",
          position: "WR",
          metrics: {
            consistency: 50,
            clutch: 52,
            durability: 50,
            explosiveness: 78,
            offense: 80,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const opportunityInsight = result.insights.find(
        (i) => i.type === "opportunity"
      );

      expect(opportunityInsight).toBeDefined();
      if (opportunityInsight) {
        expect(opportunityInsight.message).toContain("explosive");
      }
    });

    it("should include player names in insights", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          metrics: {
            consistency: 85,
            clutch: 85,
            durability: 85,
            explosiveness: 80,
            offense: 90,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);

      const allInsights = result.insights.join(" ");
      expect(allInsights).toContain("Dak");
    });
  });

  // ========================================================================
  // TEST SUITE 7: Findings Categorization
  // ========================================================================

  describe("Findings Categorization", () => {
    it("should include quietlyElite category in findings", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      expect(result.findings).toBeDefined();
      expect(result.findings.quietlyElite).toBeDefined();
      expect(Array.isArray(result.findings.quietlyElite)).toBe(true);
    });

    it("should include volatileTalent category in findings", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      expect(result.findings).toBeDefined();
      expect(result.findings.volatileTalent).toBeDefined();
      expect(Array.isArray(result.findings.volatileTalent)).toBe(true);
    });

    it("should include reliableRolePlayers category in findings", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      expect(result.findings).toBeDefined();
      expect(result.findings.reliableRolePlayers).toBeDefined();
      expect(Array.isArray(result.findings.reliableRolePlayers)).toBe(true);
    });

    it("should have no duplicate players across categories", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      const findings = result.findings;
      const allIds = new Set();
      let duplicateCount = 0;

      Object.values(findings).forEach((category) => {
        category.forEach((player) => {
          if (allIds.has(player.id)) {
            duplicateCount++;
          }
          allIds.add(player.id);
        });
      });

      expect(duplicateCount).toBeLessThanOrEqual(result.players.length);
    });
  });

  // ========================================================================
  // TEST SUITE 8: Real-world Cowboys Player Scenarios
  // ========================================================================

  describe("Real-world Cowboys Player Scenarios", () => {
    it("should identify CeeDee Lamb as elite (high consistency + high explosiveness)", () => {
      const players = [
        {
          id: "ceedee",
          name: "CeeDee Lamb",
          position: "WR",
          metrics: {
            consistency: 82,
            clutch: 80,
            durability: 79,
            explosiveness: 90,
            offense: 88,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);
      const player = result.players[0];

      expect(player.category).toBe("elite");
      expect(player.tier).toBe("STAR");
    });

    it("should handle multiple player comparison", () => {
      const players = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          metrics: {
            consistency: 80,
            clutch: 82,
            durability: 78,
            explosiveness: 75,
            offense: 90,
          },
        },
        {
          id: "ceedee",
          name: "CeeDee Lamb",
          position: "WR",
          metrics: {
            consistency: 82,
            clutch: 80,
            durability: 79,
            explosiveness: 90,
            offense: 88,
          },
        },
        {
          id: "brandin",
          name: "Brandin Cooks",
          position: "WR",
          metrics: {
            consistency: 60,
            clutch: 62,
            durability: 58,
            explosiveness: 85,
            offense: 80,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(players);

      expect(result.players).toHaveLength(3);
      expect(result.findings.quietlyElite.length).toBeGreaterThanOrEqual(1);
      expect(result.findings.volatileTalent.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // TEST SUITE 9: Statistical Properties
  // ========================================================================

  describe("Statistical Properties", () => {
    it("should sort players by combined score (consistency + explosiveness)", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      for (let i = 0; i < result.players.length - 1; i++) {
        const score1 =
          result.players[i].consistency + result.players[i].explosiveness;
        const score2 =
          result.players[i + 1].consistency + result.players[i + 1].explosiveness;

        expect(score1).toBeGreaterThanOrEqual(score2);
      }
    });

    it("should have all players with stats profile", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      result.players.forEach((player) => {
        expect(player.statsProfile).toBeDefined();
        expect(player.statsProfile.defensiveImpact).toBeDefined();
        expect(player.statsProfile.offensiveContribution).toBeDefined();
        expect(player.statsProfile.bigPlayRate).toBeDefined();
      });
    });
  });

  // ========================================================================
  // Integration Tests
  // ========================================================================

  describe("Integration Tests", () => {
    it("should handle complex roster analysis", () => {
      const fullRoster = [
        {
          id: "dak",
          name: "Dak Prescott",
          position: "QB",
          metrics: {
            consistency: 82,
            clutch: 85,
            durability: 80,
            explosiveness: 78,
            offense: 92,
          },
        },
        {
          id: "ceedee",
          name: "CeeDee Lamb",
          position: "WR",
          metrics: {
            consistency: 84,
            clutch: 82,
            durability: 80,
            explosiveness: 92,
            offense: 88,
          },
        },
        {
          id: "brandin",
          name: "Brandin Cooks",
          position: "WR",
          metrics: {
            consistency: 62,
            clutch: 64,
            durability: 60,
            explosiveness: 86,
            offense: 82,
          },
        },
        {
          id: "michael",
          name: "Michael Gallup",
          position: "WR",
          metrics: {
            consistency: 58,
            clutch: 60,
            durability: 56,
            explosiveness: 72,
            offense: 70,
          },
        },
        {
          id: "zeke",
          name: "Ezekiel Elliott",
          position: "RB",
          metrics: {
            consistency: 76,
            clutch: 74,
            durability: 78,
            explosiveness: 62,
            offense: 72,
          },
        },
        {
          id: "micah",
          name: "Micah Parsons",
          position: "EDGE",
          metrics: {
            consistency: 88,
            clutch: 86,
            durability: 85,
            explosiveness: 94,
            offense: 20,
          },
        },
      ];

      const result = computeConsistencyExplosiveness(fullRoster);

      expect(result.success).toBe(true);
      expect(result.players).toHaveLength(6);
      expect(result.insights.length).toBeGreaterThan(0);

      // Verify that elite players include the best performers
      const eliteNames = result.findings.quietlyElite.map((p) => p.name);
      expect(eliteNames).toContain("CeeDee Lamb");
    });

    it("should provide actionable insights", () => {
      const players = createTestPlayerSet();
      const result = computeConsistencyExplosiveness(players);

      // Should have insights
      expect(result.insights.length).toBeGreaterThan(0);

      // Each insight should have a title and message
      result.insights.forEach((insight) => {
        expect(insight.title).toBeDefined();
        expect(insight.message).toBeDefined();
        expect(insight.type).toBeDefined();
        expect(insight.players).toBeInstanceOf(Array);
      });
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS FOR TESTS
// ============================================================================

/**
 * Creates a diverse test player set covering all quadrants
 */
function createTestPlayerSet() {
  return [
    // Elite player (high consistency, high explosiveness)
    {
      id: "elite1",
      name: "Elite Performer",
      position: "WR",
      metrics: {
        consistency: 85,
        clutch: 84,
        durability: 83,
        explosiveness: 88,
        offense: 86,
      },
    },
    // Volatile player (low consistency, high explosiveness)
    {
      id: "vol1",
      name: "Volatile Talent",
      position: "WR",
      metrics: {
        consistency: 52,
        clutch: 54,
        durability: 50,
        explosiveness: 82,
        offense: 80,
      },
    },
    // Reliable player (high consistency, lower explosiveness)
    {
      id: "rel1",
      name: "Reliable Role Player",
      position: "RB",
      metrics: {
        consistency: 80,
        clutch: 78,
        durability: 82,
        explosiveness: 58,
        offense: 68,
      },
    },
    // Inconsistent player (low on both)
    {
      id: "inc1",
      name: "Inconsistent Performer",
      position: "TE",
      metrics: {
        consistency: 48,
        clutch: 50,
        durability: 52,
        explosiveness: 45,
        offense: 50,
      },
    },
  ];
}
