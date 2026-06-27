/**
 * C1: 스캔 결과의 alt 누락(img.alt fail) 항목에 AI 대체텍스트 제안을 채운다.
 * 가드레일: 결과는 항상 'ai-assisted' 출처 + confidence 로 표기하고,
 * 사람이 수락하기 전에는 적용하지 않는다(fix.after 에 제안만 채움).
 */
import type { Finding } from '@app/core';
import type { LlmProvider, ImageContext } from './provider';

export interface EnrichOptions {
  /** nodeId → ImageContext 매핑 (어댑터가 수집) */
  contexts?: Record<string, ImageContext>;
}

/** confidence(0~1) → Finding confidence 등급 */
function grade(c: number): Finding['confidence'] {
  if (c >= 0.66) return 'high';
  if (c >= 0.33) return 'medium';
  return 'low';
}

export async function enrichAltSuggestions(
  findings: Finding[],
  provider: LlmProvider,
  opts: EnrichOptions = {},
): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const f of findings) {
    if (f.ruleId !== 'img.alt' || f.status !== 'fail') {
      out.push(f);
      continue;
    }
    const ctx: ImageContext = opts.contexts?.[f.nodeId] ?? { nodeId: f.nodeId, name: f.nodeName };
    try {
      const s = await provider.suggestAltText(ctx);
      out.push({
        ...f,
        source: 'ai-assisted',
        confidence: grade(s.confidence),
        confidenceReason: s.rationale,
        message: s.isDecorative
          ? '이미지에 대체텍스트가 없습니다. AI: 장식 가능성 → 빈 alt 제안.'
          : `이미지에 대체텍스트가 없습니다. AI 제안: "${s.alt}"`,
        fix: f.fix && {
          ...f.fix,
          after: { ...f.fix.after, altText: s.alt, isDecorative: s.isDecorative, aiConfidence: s.confidence },
          rationale: `${s.rationale} (사람 검토·수락 후 적용)`,
        },
      });
    } catch {
      out.push(f); // 실패 시 원본 유지
    }
  }
  return out;
}
