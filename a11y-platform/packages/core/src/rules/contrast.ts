import type { Rule, A11yNode } from '../types';
import { isLargeText, worstContrast } from '../color/contrast';
import { nearestPassingColor } from '../color/nearestPassingColor';
import { makeFinding, paramOf } from './helpers';

const TEXT_TYPES = new Set<A11yNode['type']>(['text', 'link', 'button']);

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A1: 평가할 배경 후보들 (bgColors 우선, 없으면 bgColor 단일). */
function bgCandidates(node: A11yNode): string[] {
  if (node.bgColors && node.bgColors.length > 0) return node.bgColors;
  if (node.bgColor) return [node.bgColor];
  return [];
}

/** contrast.text — 텍스트 명도 대비 (보정: 색). A1 최악지점, B1 팔레트 */
export const contrastTextRule: Rule = {
  id: 'contrast.text',
  appliesTo: (n) => TEXT_TYPES.has(n.type) && !!n.fgColor && bgCandidates(n).length > 0,
  evaluate(node, ctx) {
    const p = ctx.params;
    const fg = node.fgColor!;
    const bgs = bgCandidates(node);
    const worst = worstContrast(fg, bgs); // A1: 최악 대비 지점
    const bg = worst.bg;
    const ratio = worst.ratio;
    const large = isLargeText(
      node.fontSizePx,
      node.bold,
      paramOf('contrast.text', 'largePx', p),
      paramOf('contrast.text', 'largeBoldPx', p),
    );
    const required = large
      ? paramOf('contrast.text', 'largeRatio', p)
      : paramOf('contrast.text', 'normalRatio', p);
    const multi = bgs.length > 1;

    if (ratio >= required) {
      return makeFinding('contrast.text', node, 'pass', `명도 대비 ${r2(ratio)}:1 (기준 ${required}:1 충족${multi ? ', 최악지점 기준' : ''})`, {
        evidence: { ratio: r2(ratio), required, large, multiBg: multi },
      });
    }

    const fixColor = nearestPassingColor(fg, bg, required, { palette: ctx.palette });
    const token = fixColor.adjusted === 'palette';
    return makeFinding(
      'contrast.text',
      node,
      'fail',
      `명도 대비 ${r2(ratio)}:1 로 기준 ${required}:1 에 미달합니다.${multi ? ' (그라데이션/겹침 최악지점)' : ''}`,
      {
        evidence: { ratio: r2(ratio), required, large, fgColor: fg, bgColor: bg, multiBg: multi },
        fix: {
          kind: 'color',
          before: { fgColor: fg, ratio: r2(ratio) },
          after: { fgColor: fixColor.color, ratio: r2(fixColor.ratio) },
          styleImpact: fixColor.styleImpact,
          rationale: token
            ? `디자인 팔레트 내 통과 색(${fixColor.color})으로 치환해 토큰 일관성을 유지합니다. (대비 ${r2(fixColor.ratio)}:1)`
            : `색상·채도를 유지하고 명도만 조정해 대비 ${r2(fixColor.ratio)}:1 로 보정합니다.`,
        },
      },
    );
  },
};

/** contrast.nonText — UI 요소·아이콘 대비 3:1 (보정: 색). A1/B1 적용 */
export const contrastNonTextRule: Rule = {
  id: 'contrast.nonText',
  appliesTo: (n) => (n.type === 'icon' || n.type === 'input') && !!n.fgColor && bgCandidates(n).length > 0,
  evaluate(node, ctx) {
    const required = paramOf('contrast.nonText', 'ratio', ctx.params);
    const fg = node.fgColor!;
    const bgs = bgCandidates(node);
    const worst = worstContrast(fg, bgs);
    const bg = worst.bg;
    const ratio = worst.ratio;
    if (ratio >= required) {
      return makeFinding('contrast.nonText', node, 'pass', `UI 요소 대비 ${r2(ratio)}:1 (기준 ${required}:1 충족)`, {
        evidence: { ratio: r2(ratio), required },
      });
    }
    const fixColor = nearestPassingColor(fg, bg, required, { palette: ctx.palette });
    return makeFinding('contrast.nonText', node, 'fail', `UI 요소 대비 ${r2(ratio)}:1 로 기준 ${required}:1 에 미달합니다.`, {
      evidence: { ratio: r2(ratio), required, fgColor: fg, bgColor: bg },
      fix: {
        kind: 'color',
        before: { fgColor: fg, ratio: r2(ratio) },
        after: { fgColor: fixColor.color, ratio: r2(fixColor.ratio) },
        styleImpact: fixColor.styleImpact,
        rationale: fixColor.adjusted === 'palette'
          ? `팔레트 내 통과 색(${fixColor.color})으로 치환합니다. (대비 ${r2(fixColor.ratio)}:1)`
          : `명도만 조정해 대비 ${r2(fixColor.ratio)}:1 로 보정합니다.`,
      },
    });
  },
};
