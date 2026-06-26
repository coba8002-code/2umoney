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
    evidence: opts.evidence,
    fix: opts.fix,
  };
}

/** 룰별 파라미터 (컨텍스트 오버라이드 > rules-data 기본값) */
export function paramOf(ruleId: string, key: string, override?: Record<string, number>): number {
  if (override && key in override) return override[key];
  const v = getRule(ruleId).params[key];
  if (v == null) throw new Error(`Missing param ${key} for ${ruleId}`);
  return v;
}
