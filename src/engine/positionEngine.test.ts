import { calcPositionSizing } from './positionEngine';

describe('Position Sizing Engine', () => {

  const basePortfolio = {
    totalCapitalKrw: 10000000, // 10M KRW
    accountRiskPct: 0.007,     // 0.7% Risk -> 70,000 KRW
    defaultStopLossPct: 0.018, // 1.8% SL
    defaultTakeProfitPct: 0.03,// 3% TP
  };

  const baseCurrency = {
    strategyGroup: 'A' as any,
    liquidityScore: 100
  };

  const baseSignal = {
    finalScore: 85,
    newsScore: 8,
    regimeFitScore: 18,
    currentWeightPct: 0,
    totalPortfolioOverlap: 0
  };

  test('Calculates base entry KRW and 40/30/30 splits correctly', () => {
    // Expected Base KRW = (10M * 0.007) / 0.018 = 3,888,888 KRW
    // Multipliers:
    // confidence: 1.3 (score 85)
    // stability: 0.7 + (100/100)*0.5 = 1.2
    // news: (8/10)*0.7 + 0.5 = 1.06
    // regime: 1.2 (score 18)
    // portfolio: 1.0
    // Total Mult = 1.3 * 1.2 * 1.06 * 1.2 * 1.0 = ~1.984
    // Calc Krw = 3,888,888 * 1.984 = ~7,715,555 KRW

    const result = calcPositionSizing(basePortfolio, baseCurrency, baseSignal);
    
    expect(result.recommendedTotalKrw).toBeGreaterThan(6000000);
    expect(result.firstEntryKrw).toBeCloseTo(result.recommendedTotalKrw * 0.4, -2);
    expect(result.secondEntryKrw).toBeCloseTo(result.recommendedTotalKrw * 0.3, -2);
    expect(result.thirdEntryKrw).toBeCloseTo(result.recommendedTotalKrw * 0.3, -2);
    expect(result.firstEntryKrw + result.secondEntryKrw + result.thirdEntryKrw).toBe(result.recommendedTotalKrw);
    expect(result.exceededMaxWeight).toBe(false);
  });

  test('Enforces absolute max weight caps per strategy group', () => {
    // Strategy Group C max weight is 12% = 1.2M KRW
    // If we're already holding 11% (1.1M), we only have room for 100k
    
    const result = calcPositionSizing(
       basePortfolio,
       { strategyGroup: 'C', liquidityScore: 50 },
       { ...baseSignal, currentWeightPct: 0.11 }
    );

    expect(result.recommendedTotalKrw).toBeLessThanOrEqual(100000); // 100k
    expect(result.exceededMaxWeight).toBe(false);
  });

  test('Returns 0 array when max weight is explicitly exceeded locally', () => {
    // Strategy Group D max weight is 8%
    const result = calcPositionSizing(
       basePortfolio,
       { strategyGroup: 'D', liquidityScore: 25 },
       { ...baseSignal, currentWeightPct: 0.08 } // exactly capped
    );

    expect(result.recommendedTotalKrw).toBe(0);
    expect(result.firstEntryKrw).toBe(0);
    expect(result.exceededMaxWeight).toBe(true);
  });

  test('Penalizes heavily on low scores or poor stability', () => {
    const poorSignal = {
      finalScore: 55, // Low Confidence 0.5
      newsScore: 2,   // News Mult: 2/10*0.7 + 0.5 = 0.64 
      regimeFitScore: 2, // Regime Mult 0.6
      currentWeightPct: 0,
      totalPortfolioOverlap: 0.8 // High penalty: 1 - 0.4 = 0.6
    };

    const result = calcPositionSizing(basePortfolio, baseCurrency, poorSignal);
    // Multiplier = 0.5 * 1.2(liq) * 0.64 * 0.6 * 0.6 = ~0.138
    // 3,888,888 * 0.138 = ~536,666 KRW

    expect(result.recommendedTotalKrw).toBeLessThan(1000000);
    expect(result.recommendedTotalKrw).toBeGreaterThan(0);
  });
});
