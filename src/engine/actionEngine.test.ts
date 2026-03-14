import { decideAction } from './actionEngine';
import { ActionCode } from './scoring';

describe('Action Decision Engine', () => {

  const baseInput = {
    finalScore: 50,
    expectedReturn5d: 0.01,
    dailyRsi: 50,
    dailyZScore: 0,
    dailyRangePosition: 0.5,
    isHolding: false,
    averagePrice: 1000,
    currentPrice: 1000,
    currentWeightPct: 0,
    maxWeightPct: 0.18,
    hoursToNextHighImpactEvent: null
  };

  test('Triggers EVENT Recheck on weak score close to event', () => {
    const result = decideAction({
      ...baseInput,
      finalScore: 40,
      hoursToNextHighImpactEvent: 12
    });
    expect(result.actionCode).toBe(ActionCode.RECHECK_AFTER_EVENT);
  });

  test('Triggers AUTO_EXCHANGE_SETUP for high score close to event', () => {
    const result = decideAction({
      ...baseInput,
      finalScore: 85,
      hoursToNextHighImpactEvent: 5
    });
    expect(result.actionCode).toBe(ActionCode.AUTO_EXCHANGE_SETUP);
  });

  test('Triggers BUY_1 if not holding and extremely high score', () => {
    const result = decideAction({
      ...baseInput,
      finalScore: 90,
      expectedReturn5d: 0.015,
      dailyRangePosition: 0.2
    });
    expect(result.actionCode).toBe(ActionCode.BUY_1);
    expect(result.actionReason[0]).toContain(ActionCode.BUY_1);
  });

  test('Triggers BUY_ADD (averaging down) when holding and score is high', () => {
    const result = decideAction({
      ...baseInput,
      isHolding: true,
      currentPrice: 950, // Down 5%
      finalScore: 80,
      dailyRsi: 30, // Oversold
      currentWeightPct: 0.05
    });
    expect(result.actionCode).toBe(ActionCode.BUY_ADD);
  });

  test('Respects max weight and suggests SELL_SPLIT instead of BUY', () => {
    const result = decideAction({
      ...baseInput,
      isHolding: true,
      currentPrice: 1050, // Up 5%
      currentWeightPct: 0.18,
      maxWeightPct: 0.18,
      finalScore: 80
    });
    expect(result.actionCode).toBe(ActionCode.SELL_SPLIT);
    expect(result.actionReason[0]).toContain('18%'); // Should mention the maxed weight limit
  });

  test('Triggers SELL_ALL on crash score and high Z', () => {
      const result = decideAction({
        ...baseInput,
        isHolding: true,
        finalScore: 10,
        dailyZScore: 3.0
      });
      expect(result.actionCode).toBe(ActionCode.SELL_ALL);
    });

});
