import {
  calcStructureScore,
  calcPatternScore,
  calcTimingScore,
  calcNewsScore,
  calcRegimeFitScore,
  calcExpectedValueScore,
  calcFinalDecision,
  ActionCode
} from './scoring';

describe('FX Core Scoring Engine', () => {

  test('calcStructureScore responds to RSI boundaries', () => {
    // Overbought
    const result1 = calcStructureScore({ dailyRsi: 80, weeklyRsi: 60, dailyZScore: 1, priceToMaRatio: 1.05, atrPercentage: 0.01 });
    expect(result1.score).toBe(5); // 10 Base - 5 Overbought
    expect(result1.reasoning[0]).toContain('Overbought');

    // Oversold + ZScore Low (Should cap to max 20)
    const result2 = calcStructureScore({ dailyRsi: 20, weeklyRsi: 40, dailyZScore: -2.5, priceToMaRatio: 0.9, atrPercentage: 0.01 });
    expect(result2.score).toBe(20); // 10 Base + 5 Oversold + 5 ZScore = 20
  });

  test('calcRegimeFitScore boosts for group alignment', () => {
    // Group A matches Trending
    const resA = calcRegimeFitScore({ regimeCategory: 'TRENDING_UP', regimeFitScoreOriginal: 80, strategyGroup: 'A' });
    expect(resA.score).toBe((80 / 100) * 15 + 5); 
    expect(resA.reasoning[1]).toContain('Boost');

    // Volatile penalty
    const resVolatile = calcRegimeFitScore({ regimeCategory: 'VOLATILE', regimeFitScoreOriginal: 50, strategyGroup: 'D' });
    expect(resVolatile.score).toBe((50 / 100) * 15 - 5);
  });

  test('calcExpectedValueScore reacts to high expected returns safely', () => {
    const res = calcExpectedValueScore({ expectedReturn5d: 0.02, expectedReturn10d: 0.03, estimatedMaxDrawdown: -0.005 });
    expect(res.score).toBe(15); // > 1.5% return (+10) + low MDD (+5)
  });

  test('calcFinalDecision integrates correctly to BUY_1', () => {
    const tech = { dailyRsi: 25, weeklyRsi: 40, dailyZScore: -2.1, priceToMaRatio: 0.95, atrPercentage: 0.01 }; // Struct score 20
    const pattern = { similarPatternCount: 10, averageHistoricalWinRate: 0.7, averageHistoricalReturn: 0.02 }; // Pattern Score ~15.5
    const timing = { intradayRsi: 25, intradayZScore: -1.5, distanceToLowerBandPct: 0.001 }; // Timing Score 15
    const news = { sentimentScore: 0.8, policyRiskScore: 3, upcomingHighImpactEvents: 0 }; // News Score 7.4
    const regime = { regimeCategory: 'TRENDING_UP' as any, regimeFitScoreOriginal: 90, strategyGroup: 'A' as any }; // Regime Score 18.5
    const expectedVal = { expectedReturn5d: 0.02, expectedReturn10d: 0.03, estimatedMaxDrawdown: -0.008 }; // EV Score 15

    const decision = calcFinalDecision(tech, pattern, timing, news, regime, expectedVal);
    
    // Total should be: 20 + 15.5 + 15 + 7.4 + 18.5 + 15 = 91.4
    expect(decision.finalScore).toBeCloseTo(91.4, 0);
    // Since 91.4 > 80, should be BUY_1
    expect(decision.actionCode).toBe(ActionCode.BUY_1);
    expect(decision.reasoning.length).toBeGreaterThan(5);
  });

  test('calcFinalDecision drops Action Code safely for low scores', () => {
      const tech = { dailyRsi: 80, weeklyRsi: 70, dailyZScore: 2.5, priceToMaRatio: 1.05, atrPercentage: 0.01 }; // Struct ~ 0
      const pattern = { similarPatternCount: 0, averageHistoricalWinRate: 0, averageHistoricalReturn: 0 }; // Pattern 5
      const timing = { intradayRsi: 80, intradayZScore: 2, distanceToLowerBandPct: 0.05 }; // Timing 3.5
      const news = { sentimentScore: -0.8, policyRiskScore: 9, upcomingHighImpactEvents: 2 }; // News 0 (caps at 0)
      const regime = { regimeCategory: 'VOLATILE' as any, regimeFitScoreOriginal: 30, strategyGroup: 'D' as any }; // Regime 0
      const expectedVal = { expectedReturn5d: -0.01, expectedReturn10d: -0.02, estimatedMaxDrawdown: -0.05 }; // EV 0
  
      const decision = calcFinalDecision(tech, pattern, timing, news, regime, expectedVal);
      
      expect(decision.finalScore).toBeLessThan(30);
      expect(decision.actionCode).toBe(ActionCode.SELL_ALL);
  });
});
