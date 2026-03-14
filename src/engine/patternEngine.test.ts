import { analyzePatterns, PatternFeatureVector, HistoricalPattern } from './patternEngine';

describe('Pattern Matching Engine', () => {

// Dummy 5-dimensional vectors: [maRatio, RSI, 3dRet, zScore, atrPct]
  const currentFeature: PatternFeatureVector = {
     vector: [1.02, 0.6, 0.015, 1.5, 0.01]
  };

  const db: HistoricalPattern[] = [
    {
      id: 'past-1',
      date: new Date('2024-01-01'),
      features: { vector: [1.02, 0.61, 0.016, 1.55, 0.011] }, // Very similar
      outcome3d: 0.01,
      outcome5d: 0.02,
      outcome10d: 0.03,
      outcome20d: 0.05,
      maxDrawdown10d: -0.01
    },
    {
      id: 'past-2',
      date: new Date('2023-01-01'),
      features: { vector: [1.01, 0.59, 0.014, 1.45, 0.009] }, // Very similar
      outcome3d: -0.01,
      outcome5d: 0.01,
      outcome10d: 0.04,
      outcome20d: 0.06,
      maxDrawdown10d: -0.02
    },
    {
      id: 'past-3-opposite',
      date: new Date('2022-01-01'),
      features: { vector: [0.95, 0.2, -0.05, -2.5, 0.03] }, // Completely different (Crash)
      outcome3d: 0.05,
      outcome5d: 0.1,
      outcome10d: 0.15,
      outcome20d: 0.2,
      maxDrawdown10d: -0.05
    }
  ];

  test('Calculates similarity correctly and filters opposites', () => {
    // Threshold set higher to drop 'past-3-opposite'
    const result = analyzePatterns(currentFeature, db, 0.95, 10);

    expect(result.similarPatternCount).toBe(2);

    // Expected wins out of 2 valid cases:
    // past-1 3d: 0.01 (win), past-2 3d: -0.01 (loss) -> winRate3d = 50%
    // past-1 5d: 0.02 (win), past-2 5d: 0.01 (win) -> winRate5d = 100%
    expect(result.winRate3d).toBe(0.5);
    expect(result.winRate5d).toBe(1.0);
    
    // avg Return 5d: (0.02 + 0.01) / 2 = 0.015
    expect(result.avgReturn5d).toBeCloseTo(0.015);
    
    // avg MDD: (-0.01 + -0.02) / 2 = -0.015
    expect(result.avgMaxDrawdown10d).toBeCloseTo(-0.015);
  });

  test('Fails gracefully if no match meets threshold', () => {
    // Requires near perfect 0.999 cosine score
    const result = analyzePatterns(currentFeature, db, 0.99999, 10);
    expect(result.similarPatternCount).toBe(0);
    expect(result.winRate5d).toBe(0);
  });

});
