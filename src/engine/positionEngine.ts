/**
 * Position Sizing & Allocation Engine
 */

export interface PositionConfig {
  totalCapitalKrw: number;
  accountRiskPct: number;    // e.g. 0.007 for 0.7%
  defaultStopLossPct: number;// e.g. 0.018 for 1.8%
  defaultTakeProfitPct: number; // e.g. 0.03 for 3.0%
  tradingProfile?: 'V6_MACRO_SWING' | 'V7_MARGIN_SCALP';
  leverageRatio?: number;       // e.g., 10 (10x leverage)
}

export interface CurrencyConfig {
  strategyGroup: 'A' | 'B' | 'C' | 'D';
  liquidityScore: number;    // 0 to 100
}

export interface SignalInputs {
  finalScore: number;        // 0 to 100
  newsScore: number;         // 0 to 10
  regimeFitScore: number;    // 0 to 20
  currentWeightPct: number;  // Current holding weight (e.g., 0.05)
  totalPortfolioOverlap: number; // Penalty proxy (0 to 1) for highly correlated pairs
}

export interface SizingResult {
  recommendedTotalKrw: number;
  firstEntryKrw: number;
  secondEntryKrw: number;
  thirdEntryKrw: number;
  stopLossRateDropPct: number;   // Calculated stop loss percent from entry 
  targetRate1RisePct: number;    // 1st Target distance %
  targetRate2RisePct: number;    // 2nd Target distance %
  exceededMaxWeight: boolean;    // Flag if proposed allocation exceeds limits
  logs: string[];
}

const MAX_WEIGHTS = {
  A: 0.40, // V6.0 macro swing needs heavy 40% concentration
  B: 0.35,
  C: 0.30,
  D: 0.25,
};

export function calcPositionSizing(
  portfolio: PositionConfig,
  currency: CurrencyConfig,
  signal: SignalInputs
): SizingResult {
  const logs: string[] = [];

  // ==========================================
  // 1. Base Entry KRW (Risk / StopLoss)
  // ==========================================
  // Volatility or ATR could adjust the default SL, for now we stick to portfolio default
  const stopLossPct = portfolio.defaultStopLossPct;
  const target1Pct = portfolio.defaultTakeProfitPct * 0.5; // Halfway to final TP
  const target2Pct = portfolio.defaultTakeProfitPct;

  // 권장총진입금액 = 총자금 × 계좌위험률 ÷ 손절폭
  let baseEntryKrw = (portfolio.totalCapitalKrw * portfolio.accountRiskPct) / stopLossPct;

  // Apply Leverage if Margin Strategy is active
  if (portfolio.tradingProfile === 'V7_MARGIN_SCALP') {
    const lev = portfolio.leverageRatio || 10;
    baseEntryKrw = baseEntryKrw * lev;
    logs.push(`🚀 V7 마진 스캘핑 모드 활성화: 레버리지 ${lev}x 적용 -> 1차 기초 투입액 증폭`);
  }

  logs.push(`기본 목표 투입 금액(증거금/레버리지 반영): ${Math.round(baseEntryKrw).toLocaleString()} KRW (총 자산 ${(portfolio.accountRiskPct * 100).toFixed(2)}% 리스크 / 손절폭 ${(stopLossPct * 100).toFixed(2)}%)`);

  // ==========================================
  // 2. Modifiers
  // ==========================================
  
  // 신호신뢰도계수: Scales from 0.5 to 1.5 based on 50 to 100 finalScore
  let confidenceMult = 1.0;
  if (signal.finalScore >= 80) confidenceMult = 1.3;
  else if (signal.finalScore >= 65) confidenceMult = 1.0;
  else if (signal.finalScore >= 50) confidenceMult = 0.5;
  else confidenceMult = 0.0; // Don't buy

  // 통화안정성계수: Liquidity score from 0-100 mapped to 0.7 - 1.2
  const stabilityMult = 0.7 + (currency.liquidityScore / 100) * 0.5;

  // 뉴스리스크계수: News Score 0-10, lower is worse (0 = 0.5x, 5 = 1.0x, 10 = 1.2x)
  let newsMult = signal.newsScore / 10 * 0.7 + 0.5; 
  
  // 포트폴리오중복조정계수: Lowers allocation if portfolio is highly correlated/heavy
  const portfolioMult = 1.0 - (signal.totalPortfolioOverlap * 0.5);

  // 레짐적합도계수: Regime Score 0-20. >15 = 1.2x, <5 = 0.6x
  let regimeMult = 1.0;
  if (signal.regimeFitScore >= 16) regimeMult = 1.2;
  else if (signal.regimeFitScore <= 5) regimeMult = 0.6;

  // 최종권장금액 = 기본금액 * 신호 * 안정성 * 뉴스 * 중복조정 * 레짐적합
  let finalCalculatedKrw = baseEntryKrw * confidenceMult * stabilityMult * newsMult * portfolioMult * regimeMult;
  
  logs.push(`금액 보정 승수: 신뢰도(${confidenceMult.toFixed(2)}) * 안정성(${stabilityMult.toFixed(2)}) * 뉴스(${newsMult.toFixed(2)}) * 레짐(${regimeMult.toFixed(2)}) * 포트폴리오(${portfolioMult.toFixed(2)})`);

  // ==========================================
  // 3. Max Weight Limits Check
  // ==========================================
  const maxWeight = MAX_WEIGHTS[currency.strategyGroup];
  const maxAllowedAmountKrw = portfolio.totalCapitalKrw * maxWeight;
  const currentInvestmentKrw = portfolio.totalCapitalKrw * signal.currentWeightPct;

  let exceededMaxWeight = false;
  const remainingRoomKrw = maxAllowedAmountKrw - currentInvestmentKrw;

  if (remainingRoomKrw <= 0) {
    exceededMaxWeight = true;
    finalCalculatedKrw = 0;
    logs.push(`그룹 ${currency.strategyGroup} 최대 비중(${maxWeight * 100}%) 도달. 추가 진입 금액 0원으로 제한.`);
  } else if (finalCalculatedKrw > remainingRoomKrw) {
    logs.push(`계산된 진입 금액(${Math.round(finalCalculatedKrw).toLocaleString()})이 최대 그룹 비중 여유분(${Math.round(remainingRoomKrw).toLocaleString()})을 초과하여 조정됩니다.`);
    finalCalculatedKrw = remainingRoomKrw;
  }

  // ==========================================
  // 4. Split Targets (V6 = 2 Tranches, V7 = 1 Fast Tranche)
  // ==========================================
  const finalRounded = Math.round(finalCalculatedKrw);
  let trancheEntry = Math.round(finalRounded * 0.5);
  let firstEntry = trancheEntry;
  let secondEntry = trancheEntry; // The remaining 50% for the deep DCA target
  let thirdEntry = 0; 
  
  if (portfolio.tradingProfile === 'V7_MARGIN_SCALP') {
     // Scalping usually involves a single quick entry to capture momentum
     firstEntry = finalRounded;
     secondEntry = 0;
     logs.push(`최종 권장 총 진입 금액: ${finalRounded.toLocaleString()} KRW (V7 단타 100% 진입)`);
  } else {
     logs.push(`최종 권장 총 진입 금액: ${finalRounded.toLocaleString()} KRW (V6 스윙 2분할 1차: ${trancheEntry.toLocaleString()} KRW)`);
  }

  return {
    recommendedTotalKrw: finalRounded,
    firstEntryKrw: firstEntry,
    secondEntryKrw: secondEntry,
    thirdEntryKrw: thirdEntry,
    stopLossRateDropPct: stopLossPct,
    targetRate1RisePct: target1Pct,
    targetRate2RisePct: target2Pct,
    exceededMaxWeight,
    logs
  };
}
