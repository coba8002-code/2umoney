/**
 * Score Engine for FX Trading System
 * Weights:
 *  - Structure: 20
 *  - Pattern: 20
 *  - Timing: 15
 *  - News: 10
 *  - Regime Fit: 20
 *  - Expected Value: 15
 * Total: 100
 */

// ==========================================
// Types
// ==========================================

export interface TechIndicatorsInput {
  dailyRsi: number;
  weeklyRsi: number;
  dailyZScore: number;
  priceToMaRatio: number; // Current Price / 200MA
  atrPercentage: number;   // ATR / Current Price
  tradingProfile?: 'V6_MACRO_SWING' | 'V7_MARGIN_SCALP';
}

export interface PatternInput {
  xgboostProbabilityUp5d: number; // 0 to 1 ML probability
  similarPatternCount: number;
  expectedReturn5d: number; // Avg expected return of matches
}

export interface TimingInput {
  intradayRsi: number;
  intradayZScore: number;
  distanceToLowerBandPct: number; // % distance to Bollinger lower band
}

export interface NewsInput {
  sentimentScore: number;       // -1 to 1 (1 = High confidence to buy)
  policyRiskScore: number;      // 0 to 10 (10 = High risk)
  upcomingHighImpactEvents: number; // count
}

export interface RegimeInput {
  regimeCategory: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE';
  regimeFitScoreOriginal: number; // 0 to 100 from ML Model
  strategyGroup: 'A' | 'B' | 'C' | 'D';
}

export interface ExpectedValueInput {
  expectedReturn5d: number;
  expectedReturn10d: number;
  estimatedMaxDrawdown: number;
}

export interface ScoreResult {
  score: number;
  reasoning: string[];
}

export enum ActionCode {
  WAIT = 'WAIT',
  WATCH = 'WATCH',
  BUY_1 = 'BUY_1',
  BUY_ADD = 'BUY_ADD',
  HOLD = 'HOLD',
  SELL_1 = 'SELL_1',
  SELL_SPLIT = 'SELL_SPLIT',
  SELL_ALL = 'SELL_ALL',
}

export interface FinalDecision {
  structureScore: number;
  patternScore: number;
  timingScore: number;
  newsScore: number;
  regimeFitScore: number;
  expectedValueScore: number;
  finalScore: number;
  actionCode: ActionCode;
  reasoning: string[];
  dynamicTakeProfitPct?: number;
  dynamicStopLossPct?: number;
  dynamicDcaTargetPct?: number;
}


// ==========================================
// Functions
// ==========================================

/**
 * 1. Structure Score (Max 20)
 * Evaluates macro and daily structure (oversold/overbought).
 */
export function calcStructureScore(input: TechIndicatorsInput): ScoreResult {
  let score = 10; // Baseline
  const reasoning: string[] = [];

  // RSI Logic
  if (input.dailyRsi < 30) {
    score += 5;
    reasoning.push(`Daily RSI Is Oversold (${input.dailyRsi.toFixed(1)}).`);
  } else if (input.dailyRsi > 70) {
    score -= 5;
    reasoning.push(`Daily RSI is Overbought (${input.dailyRsi.toFixed(1)}).`);
  }

  // Z-Score Mean Regression Logic
  if (input.dailyZScore < -1.0) {
    score += 5;
    reasoning.push(`Price is oversold below mean (Z: ${input.dailyZScore.toFixed(2)}).`);
  } else if (input.dailyZScore > 1.0) {
    score -= 5;
    reasoning.push(`Price is overbought above mean (Z: ${input.dailyZScore.toFixed(2)}).`);
  }

  score = Math.max(0, Math.min(20, score));
  return { score, reasoning };
}

/**
 * 2. Pattern Score (Max 20)
 * Evaluates ML XGBoost prediction + Historical Matching
 */
export function calcPatternScore(input: PatternInput): ScoreResult {
  let score = 0;
  const reasoning: string[] = [];

  // XGBoost ML Score heavily dominates this category now (Provides 0-20 points directly)
  // Maps 0.0 -> 0 points, 0.5 -> 10 points, 1.0 -> 20 points
  score += input.xgboostProbabilityUp5d * 20; 
  reasoning.push(`AI 모델 상승 예측 확률 ${(input.xgboostProbabilityUp5d * 100).toFixed(1)}% -> ${score.toFixed(1)}점 부여.`);

  // Historical Check Penalty
  if (input.similarPatternCount < 5 && input.xgboostProbabilityUp5d > 0.6) {
    score -= 3;
    reasoning.push(`과거 유사 데이터 부족(${input.similarPatternCount}개)으로 ML 예측 신뢰도 하향조정 (-3점).`);
  }

  // Strong return expectation boost
  if (input.expectedReturn5d > 0.01) {
    score += 2;
    reasoning.push(`기대 수익 가중치 반영 (+2점).`);
  }

  score = Math.max(0, Math.min(20, score));
  return { score, reasoning };
}

/**
 * 3. Timing Score (Max 15)
 * Intraday entry precision.
 */
export function calcTimingScore(input: TimingInput): ScoreResult {
  let score = 7.5; // Baseline
  const reasoning: string[] = [];

  if (input.intradayRsi < 30) {
    score += 4;
    reasoning.push('Intraday RSI suggests good entry timing.');
  } else if (input.intradayRsi > 70) {
    score -= 4;
    reasoning.push('Intraday RSI suggests poor entry timing (overbought).');
  }

  if (input.distanceToLowerBandPct < 0.005) { // Within 0.5% of lower band
    score += 3.5;
    reasoning.push('Price is hugging the lower Bollinger Band.');
  }

  score = Math.max(0, Math.min(15, score));
  return { score, reasoning };
}

/**
 * 4. News Score (Max 10)
 * Evaluates sentiment and risk.
 */
export function calcNewsScore(input: NewsInput): ScoreResult {
  let score = 5; // Neutral
  const reasoning: string[] = [];

  // Sentiment -1 to 1 scales to -3 to +3 points
  score += input.sentimentScore * 3;
  if (input.sentimentScore > 0.5) reasoning.push('Highly positive news sentiment.');
  if (input.sentimentScore < -0.5) reasoning.push('Highly negative news sentiment.');

  // Policy risk penalty
  if (input.policyRiskScore > 7) {
    score -= 3;
    reasoning.push(`High policy risk detected (${input.policyRiskScore}/10).`);
  }

  // Upcoming Event Penalty
  if (input.upcomingHighImpactEvents > 0) {
    score -= 2;
    reasoning.push(`Caution: ${input.upcomingHighImpactEvents} high-impact events upcoming.`);
  }

  score = Math.max(0, Math.min(10, score));
  return { score, reasoning };
}


/**
 * 5. Regime Fit Score (Max 20)
 * How well the current strategy fits the market regime.
 */
export function calcRegimeFitScore(input: RegimeInput): ScoreResult {
  let score = 0;
  const reasoning: string[] = [];

  // Map 0-100 ML Score to 0-15 Max points
  score += (input.regimeFitScoreOriginal / 100) * 15;
  reasoning.push(`Base regime ML fit score is ${input.regimeFitScoreOriginal.toFixed(1)}/100.`);

  // Boost for strategy alignment
  if (input.strategyGroup === 'C' && input.regimeCategory === 'RANGING') {
    score += 5;
    reasoning.push('+5 Boost: Group C currency perfectly suits a RANGING regime.');
  } else if (input.strategyGroup === 'A' && input.regimeCategory === 'TRENDING_UP') {
    score += 5;
    reasoning.push('+5 Boost: Group A currency perfectly suits a TRENDING_UP regime.');
  } else if (input.regimeCategory === 'VOLATILE') {
    score -= 5;
    reasoning.push('-5 Penalty: Highly volatile market regime.');
  }

  // Trend Filter: Penalize strong downtrend (Falling knives)
  if (input.regimeCategory === 'TRENDING_DOWN') {
    score -= 10;
    reasoning.push('🚨 -10 Penalty: Strong TRENDING_DOWN regime detected. Counter-trend longs discouraged.');
  }

  score = Math.max(0, Math.min(20, score));
  return { score, reasoning };
}

/**
 * 6. Expected Value Score (Max 15)
 * Evaluates Return vs Drawdown profile.
 */
export function calcExpectedValueScore(input: ExpectedValueInput): ScoreResult {
  let score = 0;
  const reasoning: string[] = [];

  const expectedReturnAvg = (input.expectedReturn5d + input.expectedReturn10d) / 2;
  
  if (expectedReturnAvg > 0.015) {
     score += 10;
     reasoning.push(`Strong expected return profile (${(expectedReturnAvg*100).toFixed(2)}%).`);
  } else if (expectedReturnAvg > 0) {
     score += 5;
     reasoning.push(`Positive expected return profile (${(expectedReturnAvg*100).toFixed(2)}%).`);
  } else {
     reasoning.push('Negative expected return profile.');
  }

  // Reward low maximum drawdown
  const absDrawdown = Math.abs(input.estimatedMaxDrawdown);
  if (absDrawdown < 0.01) {
    score += 5;
    reasoning.push(`Very safe downside risk (Est. MDD: ${(absDrawdown*100).toFixed(2)}%).`);
  } else if (absDrawdown > 0.03) {
    score -= 5;
    reasoning.push(`Dangerous downside risk (Est. MDD: ${(absDrawdown*100).toFixed(2)}%).`);
  }

  score = Math.max(0, Math.min(15, score));
  return { score, reasoning };
}

/**
 * 7. Final Output Calculation
 */
export function calcFinalDecision(
  techInput: TechIndicatorsInput,
  patternInput: PatternInput,
  timingInput: TimingInput,
  newsInput: NewsInput,
  regimeInput: RegimeInput,
  expectedValInput: ExpectedValueInput
): FinalDecision {
  
  const struct = calcStructureScore(techInput);
  const pattern = calcPatternScore(patternInput);
  const timing = calcTimingScore(timingInput);
  const news = calcNewsScore(newsInput);
  const regime = calcRegimeFitScore(regimeInput);
  const ev = calcExpectedValueScore(expectedValInput);

  let finalScore = parseFloat((struct.score + pattern.score + timing.score + news.score + regime.score + ev.score).toFixed(2));
  
  const reasoning = [
    ...struct.reasoning,
    ...pattern.reasoning,
    ...timing.reasoning,
    ...news.reasoning,
    ...regime.reasoning,
    ...ev.reasoning
  ];

  // 1. Dynamic TP, SL & DCA Targets based on Active Profile
  const currentAtr = techInput.atrPercentage > 0 ? techInput.atrPercentage : 0.005; // Fallback 0.5%
  
  let dynamicTakeProfitPct = parseFloat((currentAtr * 2.0).toFixed(4));
  let dynamicDcaTargetPct = parseFloat((currentAtr * 2.0).toFixed(4));
  let dynamicStopLossPct = 0; // Stop loss defaults to 0 (disabled)

  if (techInput.tradingProfile === 'V7_MARGIN_SCALP') {
    dynamicTakeProfitPct = parseFloat((currentAtr * 1.0).toFixed(4)); // Tighter TP to catch 1H-4H bursts
    dynamicStopLossPct = parseFloat((currentAtr * 0.5).toFixed(4));  // -0.5x ATR Strict Cut-loss
    dynamicDcaTargetPct = 0; // No DCA averaging down on margin scalps
    reasoning.push(`🎯 V7.0 Scalp Config -> TP Target: +${(dynamicTakeProfitPct * 100).toFixed(2)}% | Stop Loss: -${(dynamicStopLossPct * 100).toFixed(2)}%`);
    reasoning.push(`🛡️ Intraday Margin Scalp activated (Tight Cut-loss, No DCA 물타기).`);
  } else {
    reasoning.push(`🎯 V6.0 Grid Config -> TP Target: +${(dynamicTakeProfitPct * 100).toFixed(2)}% | Next DCA Level: -${(dynamicDcaTargetPct * 100).toFixed(2)}%`);
    reasoning.push(`🛡️ Macro Swing approach activated (Max 2 levels, heavily concentrated).`);
  }

  // 2. Trend Hard-Filter (Override to stop falling knives)
  if (regimeInput.regimeCategory === 'TRENDING_DOWN' && finalScore >= 50) {
    reasoning.push(`⛔ FILT: Score capped to 49 (Waterfall Downtrend - Do not catch falling knives)`);
    finalScore = 49;
  }

  // Map Final Score to Action Code
  let actionCode = ActionCode.WAIT;
  if (finalScore >= 80) {
    actionCode = ActionCode.BUY_1;
  } else if (finalScore >= 65) {
    actionCode = ActionCode.BUY_ADD;
  } else if (finalScore >= 50) {
    actionCode = ActionCode.WATCH;
  } else if (finalScore < 30) {
    actionCode = ActionCode.SELL_SPLIT;
  } else if (finalScore < 20) {
    actionCode = ActionCode.SELL_ALL;
  }

  return {
    structureScore: parseFloat(struct.score.toFixed(2)),
    patternScore: parseFloat(pattern.score.toFixed(2)),
    timingScore: parseFloat(timing.score.toFixed(2)),
    newsScore: parseFloat(news.score.toFixed(2)),
    regimeFitScore: parseFloat(regime.score.toFixed(2)),
    expectedValueScore: parseFloat(ev.score.toFixed(2)),
    finalScore,
    actionCode,
    reasoning,
    dynamicTakeProfitPct,
    dynamicStopLossPct,
    dynamicDcaTargetPct
  };
}
