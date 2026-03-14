import { calculateRegime, RegimeCode, RegimeInput } from './regimeEngine';

describe('Regime Analysis Engine', () => {

  const baseInput: RegimeInput = {
    currencyCode: 'AUD',
    strategyGroup: 'B',
    vixScore: 20,
    usdIndexTrend: 'RANGING',
    cnyVolatility: 40,
    upcomingCbEventHours: null,
    interventionProbability: 0
  };

  test('Identifies RISK_ON regime correctly for Group B', () => {
    // Vix 20 -> RISK_ON -> Group B should score high
    const result = calculateRegime(baseInput);

    expect(result.regimeCode).toBe(RegimeCode.RISK_ON);
    expect(result.regimeFitScore).toBe(18);
    expect(result.regimeAdjustment).toBe(5);
    expect(result.regimeReasoning[1]).toContain('원자재/성장 연동 B그룹');
  });

  test('Triggers GEOPOLITICAL_STRESS for high VIX', () => {
    const input = { ...baseInput, vixScore: 85 }; // VIX 85
    const result = calculateRegime(input);

    expect(result.regimeCode).toBe(RegimeCode.GEOPOLITICAL_STRESS);
    // AUD (Group B) will not be safe
    expect(result.regimeFitScore).toBe(10); // default
  });

  test('Safe Havens benefit from RISK_OFF', () => {
    const input: RegimeInput = { ...baseInput, currencyCode: 'JPY', strategyGroup: 'A', vixScore: 65 }; // VIX 65 -> RISK OFF
    const result = calculateRegime(input);

    expect(result.regimeCode).toBe(RegimeCode.RISK_OFF);
    expect(result.regimeFitScore).toBe(20);
    expect(result.regimeAdjustment).toBe(8);
    expect(result.regimeReasoning[1]).toContain('안전 자산');
  });

  test('Prioritizes INTERVENTION_RISK over everything else if probability is high', () => {
    const input: RegimeInput = { 
       currencyCode: 'JPY',
       strategyGroup: 'A',
       vixScore: 90, // Geopolitical stress
       usdIndexTrend: 'UP',
       cnyVolatility: 80,
       upcomingCbEventHours: 10,
       interventionProbability: 95 // THIS WINS
    };

    const result = calculateRegime(input);
    expect(result.regimeCode).toBe(RegimeCode.INTERVENTION_RISK);
    expect(result.regimeFitScore).toBe(18); // Since it's JPY
  });

  test('Penalizes Emerging Markets (Group D) during RISK_OFF', () => {
    const input: RegimeInput = { 
       currencyCode: 'IDR',
       strategyGroup: 'D',
       vixScore: 70, // Risk Off
       usdIndexTrend: 'RANGING',
       cnyVolatility: 40,
       upcomingCbEventHours: null,
       interventionProbability: 0 
    };

    const result = calculateRegime(input);
    expect(result.regimeCode).toBe(RegimeCode.RISK_OFF);
    expect(result.regimeFitScore).toBe(2);
    expect(result.regimeAdjustment).toBe(-8);
    expect(result.regimeReasoning[1]).toContain('이머징/아시아 통화의 가파른 매도세');
  });

});
