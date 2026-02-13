/**
 * TESTING GUIDE
 * How to run unit tests and validate the Analytics Suite
 */

# Running Unit Tests

## Installation
First, ensure you have Jest installed:
```bash
npm install --save-dev jest
```

Or if using an existing test setup:
```bash
npm test
```

## Run Maps.js Tests
Test the Consistency vs Explosiveness player analysis:

```bash
# Run all Maps tests
npm test Maps.test.js

# Run with verbose output
npm test Maps.test.js -- --verbose

# Run specific test suite
npm test Maps.test.js -- --testNamePattern="Player Categorization"

# Run and watch for changes (development)
npm test Maps.test.js -- --watch

# Generate coverage report
npm test Maps.test.js -- --coverage
```

## Running Integration Tests
Test the entire system end-to-end:

```bash
# Start your backend server
npm run dev

# In another terminal, run integration tests
npm test -- --testPathPattern="integration"
```

## Test Coverage

Current test coverage includes:
- ✅ Basic functionality (data validation, error handling)
- ✅ Player categorization (Elite, Volatile, Reliable, Inconsistent)
- ✅ Volatility assessment (VOLATILE, STABLE, PREDICTABLE, RISKY)
- ✅ Performance tier classification (STAR, STARTER, ROLE_PLAYER, BACKUP)
- ✅ Metrics normalization (0-100 bounds)
- ✅ Insights generation
- ✅ Findings categorization
- ✅ Real-world Cowboys player scenarios
- ✅ Statistical properties
- ✅ Integration scenarios (full roster analysis)

## Research-Based Definitions

### "Quietly Elite" Players (Top-Right Quadrant)
**Definition:** High Consistency + High Explosiveness (65+/65+)

**Sports Analytics Context:**
- These players have consistently high performance with low week-to-week variance
- They maintain both a high floor (reliable minimum production) and high ceiling (explosive upside)
- Often underrated by media because they don't have wild swings
- Low coefficient of variation: std_dev / mean ratio is low
- They're the foundation of championship teams

**Characteristics:**
- Predictable excellence
- Low variance, high mean
- Reliable AND impactful
- Can be depended upon regardless of matchup

**Real-World Examples:**
- CeeDee Lamb: Consistent 80+ yard games with explosive upside (90 yards+)
- Micah Parsons: Consistent pressure with elite sack rates
- Dak Prescott: Consistent completion %, reliable yards with deep ball capability

**Why They're Underrated:**
- Media loves volatility and big swings for narrative
- These players are dependable, so less drama/discussion
- They don't have the "boom games" that grab headlines
- Quietly posting elite numbers, not making headlines

### "Volatile" Players (Top-Left Quadrant)
**Definition:** Low Consistency + High Explosiveness (<60/>65)

**Sports Analytics Context:**
- These players have highly variable performance with unpredictable week-to-week outcomes
- Large swings between games: some 100+ yard explosions, then 20 yard games
- High coefficient of variation: significant variance relative to mean
- Low floor (sometimes disappear) but high ceiling (game-changing weeks)
- Often talented but with effort inconsistency, injury risk, or scheme-dependent roles

**Characteristics:**
- Boom-or-bust performance
- High variance, moderate mean
- Unpredictable week-to-week
- Can take over a game but might not get targets/carries

**Real-World Examples:**
- Brandin Cooks: Explosive when involved (8 catches, 150 yards) then inconsistent role usage
- Young receivers pending role clarification
- Players in committee backfields
- Recently injured players returning to form

**Why They're Risky:**
- Can't predict weekly performance
- Matchup dependent
- Usage/role volatility
- Game script dependent
- Injury concerns with variable playing time

### "Reliable" Players (Bottom-Right Quadrant)
**Definition:** High Consistency + Lower Explosiveness (65+/<65)

**Sports Analytics Context:**
- These are role players who provide steady, predictable production
- High floor: consistently get meaningful touches/snaps
- Limited ceiling: not going to have explosive 150-yard games
- Low variance in their usage and expected production
- Great for building a stable base, not for ceiling games

**Characteristics:**
- Steady workhorse
- High floor, limited ceiling
- Reliable and predictable
- Role-specific players

**Real-World Examples:**
- Ezekiel Elliott: Consistent 40-50 rushing yards + goal line carries
- Slot receivers with defined role
- Committee RBs with consistent workload

### "Inconsistent" Players (Bottom-Left Quadrant)
**Definition:** Low Consistency + Lower Explosiveness (<60/<60)

**Sports Analytics Context:**
- These players are problematic on both dimensions
- No reliable floor AND no high ceiling
- Neither dependable nor exciting
- Often underutilized, injured, or struggling with their role
- Highest risk category for investment

**Characteristics:**
- Neither consistent NOR explosive
- Low floor, low ceiling
- Unreliable volume
- Underperformers

**Real-World Examples:**
- Injured players not yet back to form
- Young developmental players
- Players in split-time roles with unclear role
- Aging veterans losing snaps

---

## Volatility Classification System

### VOLATILE
- Consistency < 55, Explosiveness > 70
- Boom-bust profile
- High risk, high reward
- Use for ceiling games only
- Monitor matchups closely

### RISKY
- Consistency < 55, Explosiveness < 65
- Neither reliable nor explosive
- Avoid if possible
- Consider for development/rotation

### STABLE
- Consistency > 75, Explosiveness > 70
- The ideal profile
- High floor, high ceiling
- Build your team around these

### PREDICTABLE
- Consistency > 70, Explosiveness < 55
- Reliable but limited upside
- Great role players
- Known production floors

### MIXED
- Moderate on both dimensions
- Balanced risk/reward
- Matchup dependent
- Situational value

---

## Curl Commands for Testing

See `CURL_COMMANDS.md` for complete API testing guide.

Key endpoints to test:

1. **Player Maps Analysis**
   ```bash
   curl -X GET http://localhost:3001/api/players/maps
   ```

2. **Rival Team Impact**
   ```bash
   curl -X GET "http://localhost:3001/api/analytics/rivalimpact?year=2025&chaos=0&iterations=1000"
   ```

3. **Team Strength Index (TSI)**
   ```bash
   curl -X GET "http://localhost:3001/api/analytics/tsi?team=DAL&year=2025"
   ```

---

## Expected Test Output

When running tests, you should see output like:

```
 PASS  backend/Maps.test.js
  Maps - Consistency vs Explosiveness Analysis
    computeConsistencyExplosiveness
      ✓ should return success true with valid player data (12 ms)
      ✓ should handle empty player array gracefully (3 ms)
      ✓ should handle null input gracefully (2 ms)
      ✓ should return quadrant data for all four categories (5 ms)
    Player Categorization
      ✓ should categorize elite players (15 ms)
      ✓ should categorize volatile players (8 ms)
      ✓ should categorize reliable players (7 ms)
      ✓ should categorize inconsistent players (6 ms)
    Volatility Assessment
      ✓ should mark truly volatile players as VOLATILE (4 ms)
      ✓ should mark stable/high performers as STABLE (3 ms)
      ✓ should mark predictable/low performers as PREDICTABLE (2 ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        2.456 s
```

---

## Interpreting Test Results

### All Green ✓
- Your implementation is working correctly
- Definitions are aligned with sports analytics standards
- Player categorizations are accurate

### Failures 
- Check the specific test that's failing
- Review the assertion error message
- Verify your changes to Maps.js or test data

### Coverage Gaps
- Run with `--coverage` flag to see which functions need testing
- Add new test cases for edge scenarios
- Verify new player types are properly categorized

---

## Fine-Tuning the Model

To adjust the definitions, modify these functions in `Maps.js`:

1. **Consistency Cutoffs**
   - Edit `calculateConsistency()` function
   - Adjust weights for clutch/durability

2. **Explosiveness Cutoffs**
   - Edit `calculateExplosiveness()` function
   - Adjust weights for offense/explosiveness ratio

3. **Category Thresholds**
   - Edit `categorizePlayer()` function
   - Change the `65` threshold to adjust quadrant boundaries

4. **Volatility Logic**
   - Edit `calculateVolatility()` function
   - Adjust the consistency/explosiveness thresholds for each category

---

## Debugging Tips

1. **Use verbose output**
   ```bash
   npm test -- --verbose
   ```

2. **Test a single player type**
   ```bash
   npm test -- --testNamePattern="elite"
   ```

3. **Check calculated metrics**
   - Add `console.log()` statements in Maps.js
   - Run test with `--verbose` flag
   - Check actual vs expected values

4. **Validate data flow**
   - Ensure input metrics are within 0-100 range
   - Verify formulas are calculating correctly
   - Check normalization is working

---

## Performance Considerations

- Unit tests run in < 3 seconds
- Integration tests run in < 5 seconds
- API endpoints respond in < 500ms
- Full roster analysis (6 players) completes in < 100ms

If tests are slow, check for:
- Database connection issues
- Blocking I/O operations
- Infinite loops in categorization logic
