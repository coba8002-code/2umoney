import { getRule } from '@app/rules-data';
import type { Finding, FindingStatus, A11yNode, FixSuggestion } from '../types';

/** rules-data 의 메타(criterion/standard/severity)를 채워 Finding 을 만든다. */
export function makeFinding(
  ruleId: string,
  node: A11yNode,
  status: FindingStatus,
  message: string,
  opts: {
    source?: Finding['source'];
    evidence?: Record<string, unknown>;
    fix?: FixSuggestion;
    confidence?: Finding['confidence'];
    confidenceReason?: string;
  } = {},
): Finding {
  const rule = getRule(ruleId);
  return {
    ruleId,
    standard: rule.standard,
    criterion: rule.criterion,
    status,
    severity: rule.severity,
    source: opts.source ?? (rule.fixable === 'ai' ? 'ai-assisted' : 'auto'),
    nodeId: node.id,
    nodeName: node.name,
    message,
    confidence: opts.confidence ?? 'high',
    confidenceReason: opts.confidenceReason,
    evidence: opts.evidence,
    fix: opts.fix,
  };
}

/**
 * A3: 의미 속성(alt/label/focus)에 의존하는 룰의 신뢰도.
 * 노드의 semanticsReliable 이 false(예: Figma 레이어명 휴리스틱)면 low.
 */
export function semanticConfidence(node: A11yNode): {
  confidence: Finding['confidence'];
  confidenceReason?: string;
} {
  if (node.semanticsReliable === false) {
    return { confidence: 'low', confidenceReason: '레이어명 등 휴리스틱 추론 — 사람 확인 권장' };
  }
  return { confidence: 'high' };
}

/** 룰별 파라미터 (컨텍스트 오버라이드 > rules-data 기본값) */
export function paramOf(ruleId: string, key: string, override?: Record<string, number>): number {
  if (override && key in override) return override[key];
  const v = getRule(ruleId).params[key];
  if (v == null) throw new Error(`Missing param ${key} for ${ruleId}`);
  return v;
}
