import type { A11yNode, Finding, ScanResult, ScanSummary, Rule, RuleContext } from './types';
import { autoRuleRegistry } from './rules';

export interface ScanOptions extends RuleContext {
  rules?: Rule[];
}

/** 트리를 평탄화 (깊이 우선) */
export function flatten(nodes: A11yNode[]): A11yNode[] {
  const out: A11yNode[] = [];
  const walk = (n: A11yNode) => {
    out.push(n);
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

export function scanNodes(roots: A11yNode[], opts: ScanOptions = {}): ScanResult {
  const rules = opts.rules ?? autoRuleRegistry;
  const ctx: RuleContext = { params: opts.params, palette: opts.palette };
  const findings: Finding[] = [];

  for (const node of flatten(roots)) {
    for (const rule of rules) {
      if (!rule.appliesTo(node)) continue;
      const f = rule.evaluate(node, ctx);
      if (f) findings.push(f);
    }
  }

  return { findings, summary: summarize(findings) };
}

export function summarize(findings: Finding[]): ScanSummary {
  let pass = 0;
  let fail = 0;
  let manual = 0;
  for (const f of findings) {
    if (f.status === 'pass') pass++;
    else if (f.status === 'fail') fail++;
    else manual++;
  }
  const autoTotal = pass + fail; // 자동 판정 가능한 항목만
  const estimatedPassRate = autoTotal === 0 ? 1 : pass / autoTotal;
  return {
    pass,
    fail,
    manual,
    total: findings.length,
    estimatedPassRate,
    estimatedPassRateLabel: '자동판정 항목 기준 (전체 접근성 보장 아님)',
  };
}
