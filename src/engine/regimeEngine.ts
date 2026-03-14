/**
 * Regime Engine for FX Trading System
 * Evaluates macro market regimes and maps them to strategy group fitness.
 */

export enum RegimeCode {
  USD_STRONG = 'USD_STRONG',
  USD_WEAK = 'USD_WEAK',
  RISK_ON = 'RISK_ON',
  RISK_OFF = 'RISK_OFF',
  CENTRAL_BANK_EVENT = 'CENTRAL_BANK_EVENT',
  INFLATION_SHOCK = 'INFLATION_SHOCK',
  INTERVENTION_RISK = 'INTERVENTION_RISK',
  CHINA_SENSITIVE = 'CHINA_SENSITIVE',
  GEOPOLITICAL_STRESS = 'GEOPOLITICAL_STRESS',
  NEUTRAL = 'NEUTRAL'
}

export interface RegimeInput {
  currencyCode: string;
  strategyGroup: 'A' | 'B' | 'C' | 'D';
  // Mock ML/Data inputs:
  vixScore: number;                 // 0-100 (High implies Stress / Risk Off)
  usdIndexTrend: 'UP' | 'DOWN' | 'RANGING';
  cnyVolatility: number;            // 0-100 (High implies China Sensitive)
  upcomingCbEventHours: number | null; 
  interventionProbability: number;  // 0-100 (e.g. BoJ/PBoC watch)
}

export interface RegimeResult {
  regimeCode: RegimeCode;
  regimeLabel: string;
  regimeFitScore: number;     // 0 to 20
  regimeAdjustment: number;   // -10 to +10 (Score modifier for final decisions)
  regimeReasoning: string[];
}

/**
 * TODO: [Data Integration] Connect to Macro Data API (e.g. FRED, Yahoo Finance)
 * Feed real VIX, USD Index, and Event proximities to RegimeInput.
 * 1. Mock ML Engine: Determines the current dominating global regime based on raw indicators
 */
function determineGlobalRegime(input: RegimeInput): { code: RegimeCode, label: string } {
  // Ordered by precedence
  if (input.interventionProbability > 80) {
    return { code: RegimeCode.INTERVENTION_RISK, label: "개입 경계 (Intervention Risk)" };
  }
  
  if (input.upcomingCbEventHours !== null && input.upcomingCbEventHours < 48) {
    return { code: RegimeCode.CENTRAL_BANK_EVENT, label: "중앙은행 이벤트 (CB Event)" };
  }

  if (input.vixScore > 75) {
     return { code: RegimeCode.GEOPOLITICAL_STRESS, label: "지정학적 리스크 (Geopolitical Stress)" };
  }
  
  if (input.vixScore > 60) {
     return { code: RegimeCode.RISK_OFF, label: "위험 회피 (Risk Off)" };
  }

  if (input.cnyVolatility > 70) {
    return { code: RegimeCode.CHINA_SENSITIVE, label: "중국 민감성 (China Sensitive)" };
  }

  if (input.usdIndexTrend === 'UP') {
     return { code: RegimeCode.USD_STRONG, label: "강달러 (USD Strong)" };
  } else if (input.usdIndexTrend === 'DOWN') {
     return { code: RegimeCode.USD_WEAK, label: "약달러 (USD Weak)" };
  }
  
  if (input.vixScore < 30) {
     return { code: RegimeCode.RISK_ON, label: "위험 선호 (Risk On)" };
  }

  return { code: RegimeCode.NEUTRAL, label: "중립 (Neutral)" };
}

/**
 * 2. Fit Engine: Maps the global regime to a specific currency group
 */
export function calculateRegime(input: RegimeInput): RegimeResult {
  const { code: regimeCode, label: regimeLabel } = determineGlobalRegime(input);
  
  let fitScore = 10; // Baseline 10/20
  let adjustment = 0;
  const reasoning: string[] = [`현재 글로벌 시장 국면은 [${regimeLabel}] 입니다.`];

  switch(regimeCode) {
    case RegimeCode.RISK_ON:
      if (input.strategyGroup === 'B') {
        // AUD, CAD, NZD heavily benefit
        fitScore = 18;
        adjustment = 5;
        reasoning.push('리스크 온(위험 선호) 국면에서 원자재/성장 연동 B그룹의 퍼포먼스가 기대됩니다.');
      } else if (input.strategyGroup === 'D') {
        fitScore = 15;
        adjustment = 3;
        reasoning.push('위험 선호 국면에서 신흥국 D그룹 통화가 수혜를 볼 수 있습니다.');
      }
      break;

    case RegimeCode.RISK_OFF:
    case RegimeCode.GEOPOLITICAL_STRESS:
      if (input.currencyCode === 'USD' || input.currencyCode === 'CHF' || input.currencyCode === 'JPY') {
        fitScore = 20;
        adjustment = 8;
        reasoning.push('안전 자산(USD/CHF/JPY) 수요가 급증하는 국면으로 진입 적합도가 매우 높습니다.');
      } else if (input.strategyGroup === 'D' || input.strategyGroup === 'C') {
        fitScore = 2;
        adjustment = -8;
        reasoning.push('리스크 오프 국면에서 이머징/아시아 통화의 가파른 매도세가 예상되어 진입을 억제합니다.');
      }
      break;

    case RegimeCode.USD_STRONG:
      if (input.currencyCode === 'USD') {
        fitScore = 18;
        adjustment = 5;
        reasoning.push('강달러 기조에 부합하는 매수 타겟입니다.');
      } else {
        fitScore = 5;
        adjustment = -3;
        reasoning.push('강달러 국면에서 상대 통화(Non-USD)의 약세 압력이 강합니다.');
      }
      break;

    case RegimeCode.USD_WEAK:
      if (input.currencyCode === 'USD') {
        fitScore = 2;
        adjustment = -6;
        reasoning.push('약달러 기조 속에서 USD 매수는 불리합니다.');
      } else if (input.strategyGroup === 'A') {
        fitScore = 16;
        adjustment = 4;
        reasoning.push('달러 약세의 반사 이익으로 메이저 A그룹 통화들의 강세가 기대됩니다.');
      }
      break;

    case RegimeCode.CHINA_SENSITIVE:
      if (input.strategyGroup === 'C' || input.strategyGroup === 'B') {
        fitScore = 4;
        adjustment = -5;
        reasoning.push('중국 매크로 변동성 심화로 중화권(C) 및 오세아니아(B) 통화의 리스크가 큽니다.');
      }
      break;

    case RegimeCode.INTERVENTION_RISK:
      if (input.currencyCode === 'JPY' || input.currencyCode === 'CNY') {
        fitScore = 18;
        adjustment = 6;
        reasoning.push('외환당국 개입 경계감이 극대화되어 반사적 급반등(Short Squeeze)을 노릴 수 있는 특수 국면입니다.');
      }
      break;

    case RegimeCode.CENTRAL_BANK_EVENT:
      fitScore = 5;
      adjustment = -4;
      reasoning.push('주요 통화정책 이벤트가 스케쥴되어 있어 매크로 방향성이 결정되기 전까지 보수적 접근이 필요합니다.');
      break;
      
    case RegimeCode.NEUTRAL:
      reasoning.push('거시적 쏠림이 뚜렷하지 않아 개별 통화 패턴 및 기술적 구조를 신뢰할 수 있습니다.');
      break;
  }

  return {
    regimeCode,
    regimeLabel,
    regimeFitScore: Math.max(0, Math.min(20, fitScore)),
    regimeAdjustment: Math.max(-10, Math.min(10, adjustment)),
    regimeReasoning: reasoning
  };
}
