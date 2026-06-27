import type { A11yNode, Finding, RuleContext } from '../types';
import { makeFinding, paramOf } from './helpers';

/**
 * heading.structure — 제목 레벨 건너뜀 검사 (문서 순서 의존 → per-node 가 아닌 후처리).
 * headingLevel 이 있는 노드를 문서 순서대로 보며 직전 레벨보다 maxSkip 초과로
 * 깊어지면(예: h1 → h3) fail. HTML 어댑터에서 headingLevel 을 채운다.
 */
export function headingStructureFindings(orderedNodes: A11yNode[], ctx: RuleContext = {}): Finding[] {
  const maxSkip = paramOf('heading.structure', 'maxSkip', ctx.params);
  const headings = orderedNodes.filter((n) => typeof n.headingLevel === 'number');
  if (headings.length === 0) return [];

  const findings: Finding[] = [];
  let prev = 0;
  for (const h of headings) {
    const level = h.headingLevel!;
    if (prev === 0) {
      if (level !== 1) {
        findings.push(
          makeFinding('heading.structure', h, 'fail', `첫 제목이 h${level} 입니다. 문서는 h1 으로 시작하는 것이 권장됩니다.`, {
            evidence: { level, expected: 1 },
          }),
        );
      } else {
        findings.push(makeFinding('heading.structure', h, 'pass', 'h1 로 시작합니다.', { evidence: { level } }));
      }
    } else if (level - prev > maxSkip) {
      findings.push(
        makeFinding('heading.structure', h, 'fail', `제목 레벨이 h${prev} → h${level} 로 건너뜁니다(최대 +${maxSkip}). 단계를 건너뛰지 마세요.`, {
          evidence: { from: prev, to: level, maxSkip },
        }),
      );
    } else {
      findings.push(makeFinding('heading.structure', h, 'pass', `h${prev} → h${level} 단계 정상.`, { evidence: { from: prev, to: level } }));
    }
    prev = level;
  }
  return findings;
}
