import type { Rule, A11yNode } from '../types';
import { contrastRatio, isLargeText } from '../color/contrast';
import { nearestPassingColor } from '../color/nearestPassingColor';
import { makeFinding, paramOf } from './helpers';

const TEXT_TYPES = new Set<A11yNode['type']>(['text', 'link', 'button']);

/** contrast.text — 텍스트 명도 대비 (보정: 색) */
export const contrastTextRule: Rule = {
  id: 'contrast.text',
  appliesTo: (n) => TEXT_TYPES.has(n.type) && !!n.fgColor && !!n.bgColor,
  evaluate(node, ctx) {
    const p = ctx.params;
    const fg = node.fgColor!;
    const bg = node.bgColor!;
    const ratio = contrastRatio(fg, bg);
    const large = isLargeText(
      node.fontSizePx,
      node.bold,
      paramOf('contrast.text', 'largePx', p),
      paramOf('contrast.text', 'largeBoldPx', p),
    );
    const required = large
      ? paramOf('contrast.text', 'largeRatio', p)
      : paramOf('contrast.text', 'normalRatio', p);
    const r2 = Math.round(ratio * 100) / 100;

    if (ratio >= required) {
      return makeFinding('contrast.text', node, 'pass', `명도 대비 ${r2}:1 (기준 ${required}:1 충족)`, {
        evidence: { ratio: r2, required, large },
      });
    }

    const fixColor = nearestPassingColor(fg, bg, required);
    return makeFinding(
      'contrast.text',
      node,
      'fail',
      `명도 대비 ${r2}:1 로 기준 ${required}:1 에 미달합니다.`,
      {
        evidence: { ratio: r2, required, large, fgColor: fg, bgColor: bg },
        fix: {
          kind: 'color',
          before: { fgColor: fg, ratio: r2 },
          after: { fgColor: fixColor.color, ratio: Math.round(fixColor.ratio * 100) / 100 },
          styleImpact: fixColor.styleImpact,
          rationale: `색상·채도를 유지하고 명도만 조정해 대비 ${Math.round(fixColor.ratio * 100) / 100}:1 로 보정합니다.`,
        },
      },
    );
  },
};

/** contrast.nonText — UI 요소·아이콘 대비 3:1 (보정: 색) */
export const contrastNonTextRule: Rule = {
  id: 'contrast.nonText',
  appliesTo: (n) => (n.type === 'icon' || n.type === 'input') && !!n.fgColor && !!n.bgColor,
  evaluate(node, ctx) {
    const required = paramOf('contrast.nonText', 'ratio', ctx.params);
    const fg = node.fgColor!;
    const bg = node.bgColor!;
    const ratio = contrastRatio(fg, bg);
    const r2 = Math.round(ratio * 100) / 100;
    if (ratio >= required) {
      return makeFinding('contrast.nonText', node, 'pass', `UI 요소 대비 ${r2}:1 (기준 ${required}:1 충족)`, {
        evidence: { ratio: r2, required },
      });
    }
    const fixColor = nearestPassingColor(fg, bg, required);
    return makeFinding('contrast.nonText', node, 'fail', `UI 요소 대비 ${r2}:1 로 기준 ${required}:1 에 미달합니다.`, {
      evidence: { ratio: r2, required, fgColor: fg, bgColor: bg },
      fix: {
        kind: 'color',
        before: { fgColor: fg, ratio: r2 },
        after: { fgColor: fixColor.color, ratio: Math.round(fixColor.ratio * 100) / 100 },
        styleImpact: fixColor.styleImpact,
        rationale: `명도만 조정해 대비 ${Math.round(fixColor.ratio * 100) / 100}:1 로 보정합니다.`,
      },
    });
  },
};
