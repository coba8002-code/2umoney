import type { Rule, A11yNode } from '../types';
import { makeFinding, paramOf } from './helpers';

const INTERACTIVE = new Set<A11yNode['type']>(['button', 'link', 'input']);

/** target.size — 터치 타깃 ≥44×44px (보정: 크기) */
export const targetSizeRule: Rule = {
  id: 'target.size',
  appliesTo: (n) => INTERACTIVE.has(n.type) && n.width != null && n.height != null,
  evaluate(node, ctx) {
    const min = paramOf('target.size', 'minPx', ctx.params);
    const w = node.width!;
    const h = node.height!;
    if (w >= min && h >= min) {
      return makeFinding('target.size', node, 'pass', `터치 타깃 ${Math.round(w)}×${Math.round(h)}px (기준 ${min}px 충족)`, {
        evidence: { width: w, height: h, min },
      });
    }
    return makeFinding(
      'target.size',
      node,
      'fail',
      `터치 타깃 ${Math.round(w)}×${Math.round(h)}px 로 최소 ${min}×${min}px 에 미달합니다.`,
      {
        evidence: { width: w, height: h, min },
        fix: {
          kind: 'touchTarget',
          before: { width: w, height: h },
          after: { width: Math.max(w, min), height: Math.max(h, min) },
          styleImpact: 'visible',
          rationale: `최소 터치 영역 확보를 위해 ${min}px 이상으로 확대합니다. (중심 정렬 권장)`,
        },
      },
    );
  },
};

/** text.size — 본문 최소 글자 크기 경고 (보정: 크기) */
export const textSizeRule: Rule = {
  id: 'text.size',
  appliesTo: (n) => n.type === 'text' && n.fontSizePx != null,
  evaluate(node, ctx) {
    const min = paramOf('text.size', 'minBodyPx', ctx.params);
    const rec = paramOf('text.size', 'recommendedBodyPx', ctx.params);
    const size = node.fontSizePx!;
    if (size >= min) {
      return makeFinding('text.size', node, 'pass', `글자 크기 ${size}px (최소 ${min}px 충족)`, {
        evidence: { fontSizePx: size, min, recommended: rec },
      });
    }
    return makeFinding('text.size', node, 'fail', `글자 크기 ${size}px 로 최소 권장 ${min}px 미만입니다.`, {
      evidence: { fontSizePx: size, min, recommended: rec },
      fix: {
        kind: 'fontSize',
        before: { fontSizePx: size },
        after: { fontSizePx: rec },
        styleImpact: 'visible',
        rationale: `가독성을 위해 본문 권장 크기 ${rec}px 로 확대합니다.`,
      },
    });
  },
};
