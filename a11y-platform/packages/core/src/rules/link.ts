import type { Rule } from '../types';
import { makeFinding, semanticConfidence } from './helpers';

/**
 * link.identifiable — 링크가 색에만 의존하지 않고 구분 가능한지 (WCAG 1.4.1).
 * textDecoration 정보가 있을 때만 자동 판정. 밑줄/취소선 등 비색상 단서가 없으면 fail.
 */
export const linkIdentifiableRule: Rule = {
  id: 'link.identifiable',
  appliesTo: (n) => n.type === 'link' && n.textDecoration != null,
  evaluate(node) {
    const hasNonColorCue = node.textDecoration === 'underline' || node.textDecoration === 'overline';
    if (hasNonColorCue) {
      return makeFinding('link.identifiable', node, 'pass', '밑줄 등 색에 무관한 단서로 링크를 구분할 수 있습니다.', {
        evidence: { textDecoration: node.textDecoration },
      });
    }
    return makeFinding(
      'link.identifiable',
      node,
      'fail',
      '링크가 색에만 의존해 구분됩니다. 밑줄 등 비색상 단서를 추가하세요(색각 이상 사용자 고려).',
      {
        ...semanticConfidence(node),
        evidence: { textDecoration: node.textDecoration ?? null },
      },
    );
  },
};
