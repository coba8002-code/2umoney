import type { Rule } from '../types';
import { makeFinding, paramOf } from './helpers';

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** text.lineHeight — 행간이 글자 크기의 권장 배수 이상인지 (보정 없음, 권고) */
export const lineHeightRule: Rule = {
  id: 'text.lineHeight',
  appliesTo: (n) => n.type === 'text' && n.fontSizePx != null && n.lineHeightPx != null,
  evaluate(node, ctx) {
    const minRatio = paramOf('text.lineHeight', 'minRatio', ctx.params);
    const ratio = node.lineHeightPx! / node.fontSizePx!;
    if (ratio >= minRatio - 1e-6) {
      return makeFinding('text.lineHeight', node, 'pass', `행간 비율 ${r2(ratio)} (권장 ${minRatio} 이상)`, {
        evidence: { ratio: r2(ratio), minRatio },
      });
    }
    return makeFinding('text.lineHeight', node, 'fail', `행간 비율 ${r2(ratio)} 로 권장 ${minRatio} 미만입니다. 가독성을 위해 줄 간격을 넓히세요.`, {
      evidence: { ratio: r2(ratio), minRatio, recommendedPx: Math.ceil(node.fontSizePx! * minRatio) },
    });
  },
};

/** text.letterSpacing — 과도하게 좁은 자간 경고 (음수 자간 등) */
export const letterSpacingRule: Rule = {
  id: 'text.letterSpacing',
  appliesTo: (n) => n.type === 'text' && n.fontSizePx != null && n.letterSpacingPx != null,
  evaluate(node, ctx) {
    // 음수 자간(글자가 겹쳐 보이는 수준)을 경고. minRatioEm 은 음수 허용 한계의 절대값.
    const limitEm = paramOf('text.letterSpacing', 'minRatioEm', ctx.params);
    const em = node.letterSpacingPx! / node.fontSizePx!;
    if (em >= -limitEm) {
      return makeFinding('text.letterSpacing', node, 'pass', `자간 ${r2(em)}em (허용 범위)`, {
        evidence: { em: r2(em), limitEm },
      });
    }
    return makeFinding('text.letterSpacing', node, 'fail', `자간 ${r2(em)}em 로 과도하게 좁습니다(${-limitEm}em 미만). 글자가 겹쳐 가독성을 해칩니다.`, {
      evidence: { em: r2(em), limitEm },
    });
  },
};
