import { ActionCode } from './scoring';

export interface ActionInput {
  finalScore: number;
  expectedReturn5d: number;
  dailyRsi: number;
  dailyZScore: number;
  dailyRangePosition: number; // 0 to 1 (0 = daily low, 1 = daily high)
  
  // Position Info
  isHolding: boolean;
  averagePrice: number;
  currentPrice: number;
  currentWeightPct: number; // e.g. 0.05 for 5%
  maxWeightPct: number;     // e.g. 0.18 for 18%

  // Event Info
  hoursToNextHighImpactEvent: number | null; // null if > 48h
}

export interface ActionResult {
  actionCode: ActionCode;
  actionLabel: string;
  actionReason: string[];
}

/**
 * Maps the raw inputs and Portfolio state into a discrete Action Response
 */
export function decideAction(input: ActionInput): ActionResult {
  const reasons: string[] = [];
  let code = ActionCode.WAIT;
  let label = "관망";

  const {
    finalScore,
    expectedReturn5d,
    dailyRsi,
    dailyZScore,
    dailyRangePosition,
    isHolding,
    averagePrice,
    currentPrice,
    currentWeightPct,
    maxWeightPct,
    hoursToNextHighImpactEvent
  } = input;

  const returnPct = isHolding ? (currentPrice - averagePrice) / averagePrice : 0;
  const isWeightMaxed = currentWeightPct >= maxWeightPct;

  // 1. EVENT CHECK (Takes highest precedence if event is close)
  if (hoursToNextHighImpactEvent !== null && hoursToNextHighImpactEvent <= 24) {
    // Event is happening within 24 hours
    if (finalScore >= 70 && !isHolding) {
      // High conviction setup but event is close -> set Toss auto exchange
      code = ActionCode.AUTO_EXCHANGE_SETUP;
      label = "자동환전 예약 (이벤트 대기)";
      reasons.push(`고득점(${finalScore}점)이나 ${hoursToNextHighImpactEvent}시간 내 주요 이벤트가 있어 직접 진입 대신 낮은 가격에 토스 자동환전 설정을 권장합니다.`);
      return { actionCode: code, actionLabel: label, actionReason: reasons };
    }

    if (finalScore < 50) {
      // Weak setup + event coming -> Wait or Recheck
      code = ActionCode.RECHECK_AFTER_EVENT;
      label = "이벤트 후 재확인";
      reasons.push(`불안정한 점수(${finalScore}점)와 ${hoursToNextHighImpactEvent}시간 내 주요 이벤트 리스크로 인해 섣부른 진입을 피하고 이벤트 소화 후 재평가합니다.`);
      return { actionCode: code, actionLabel: label, actionReason: reasons };
    }
  }

  // 2. POSITION: NOT HOLDING
  if (!isHolding) {
    if (finalScore >= 80 && expectedReturn5d >= 0.01) {
      code = ActionCode.BUY_1;
      label = "1차 매수 진입";
      reasons.push(`최종 점수 우수(${finalScore}점) 및 단기 기대수익률 양호. 1차 분할 매수 적기입니다.`);

      if (dailyRangePosition < 0.3) {
        reasons.push(`일간 밴드 하단(${Math.round(dailyRangePosition*100)}%)에 위치하여 단기 유리한 타점입니다.`);
      }

    } else if (finalScore >= 65) {
      code = ActionCode.WATCH;
      label = "관심 구간 집중 모니터링";
      reasons.push(`최종 점수가 유의미한 수준(${finalScore}점)이나 즉각 진입하기엔 부족합니다. Z-Score(${dailyZScore.toFixed(2)}) 등을 모니터링 하십시오.`);
      
    } else {
      code = ActionCode.WAIT;
      label = "관망";
      reasons.push(`해당 시점에서의 통계적 우위가 낮습니다 (최종 점수: ${finalScore}점). 매수 금지.`);
    }

    // Toss Auto Exchange Setup for Missed bottom
    if (code === ActionCode.WATCH && dailyZScore < -1.5) {
      code = ActionCode.AUTO_EXCHANGE_SETUP;
      label = "자동환전 줍줍 설정";
      reasons.push(`가격이 밴드 하단 이탈 중입니다 (Z: ${dailyZScore.toFixed(2)}). 더 밀릴 경우를 대비해 하단 자동환전을 설정해두는 것이 유리합니다.`);
    }

    return { actionCode: code, actionLabel: label, actionReason: reasons };
  }

  // 3. POSITION: CURRENTLY HOLDING
  
  if (isWeightMaxed) {
    reasons.push(`전략 그룹 최대 허용 비중(${maxWeightPct * 100}%)에 도달. 추가 매수 불가.`);
    
    // Evaluate if we should sell since we are maxed
    if (dailyRsi > 70 || finalScore < 40) {
      code = ActionCode.SELL_SPLIT;
      label = "비중 축소 (분할 매도)";
      reasons.push(`과매수 진입(RSI ${dailyRsi.toFixed(1)}) 또는 점수하락으로 인해 리스크 관리 차원의 비중 축소를 권장합니다.`);
    } else if (returnPct > 0.03) {
      code = ActionCode.SELL_SPLIT;
      label = "수익 실현 (분할 매도)";
      reasons.push(`목표 수익률 달성(${(returnPct*100).toFixed(1)}%). 일부 물량을 정리하여 차익을 실현하십시오.`);
    } else {
      code = ActionCode.HOLD;
      label = "보유";
      reasons.push(`현재 비중 최고치 상태로 포지션을 유지합니다.`);
    }

    return { actionCode: code, actionLabel: label, actionReason: reasons };
  }

  // Holding but NOT maxed weight
  if (finalScore >= 75) {
    if (returnPct < -0.01 && dailyRsi < 35) {
      code = ActionCode.BUY_ADD;
      label = "추가 매수 (물타기)";
      reasons.push(`강력한 통계적 우위(${finalScore}점)와 단기 과매도 상태(RSI ${dailyRsi.toFixed(1)})가 맞물려 단가 낮추기 용 추가 매수를 지시합니다.`);
    } else {
       code = ActionCode.HOLD;
       label = "보유 (강세)";
       reasons.push(`추가 진입할 만큼 단가가 매력적이진 않으나 긍정적 지표 유지 중. 이익 극대화를 위해 보유합니다.`);
    }
  } else if (finalScore < 30 || dailyZScore > 2.5) {
    code = ActionCode.SELL_ALL;
    label = "전량 매도 (포지션 청산)";
    reasons.push(`시스템 점수 급락(${finalScore}점) 및 가격 단기 이상 급등(Z: ${dailyZScore.toFixed(2)}). 즉각적인 전량 청산을 통해 리스크를 차단하십시오.`);
  } else if (dailyRsi > 75 || returnPct > 0.05) {
    code = ActionCode.SELL_1;
    label = "1차 매도 (차익 실현)";
    reasons.push(`과매수 진입 및 양호한 수익률. 부분 차익 실현을 시작하십시오.`);
  } else {
    code = ActionCode.HOLD;
    label = "보유";
    reasons.push(`특이 사항 없음. 기존의 포지션을 그대로 유지합니다.`);
  }

  return { actionCode: code, actionLabel: label, actionReason: reasons };
}
