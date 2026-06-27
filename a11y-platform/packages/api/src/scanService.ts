/**
 * D: 스캔 서비스 — DOM 스냅샷을 코어 룰셋으로 검사하고, 선택적으로
 * axe-core 결과를 병합한다. (룰셋은 packages/core 를 재사용 — 단일 소스)
 */
import { scanNodes, type ScanResult, type Finding } from '@app/core';
import { snapshotToA11yNodes, type DomSnapshot } from './htmlAdapter';

/** axe-core 결과의 최소 형태 (병합용) */
export interface AxeViolationLike {
  id: string; // axe rule id
  impact?: 'critical' | 'serious' | 'moderate' | 'minor';
  description?: string;
  help?: string;
  nodes?: { target?: string[] }[];
}

export interface ScanServiceOptions {
  palette?: string[];
  axeViolations?: AxeViolationLike[];
}

const SEV_MAP: Record<string, Finding['severity']> = {
  critical: 'critical',
  serious: 'serious',
  moderate: 'moderate',
  minor: 'minor',
};

/** axe 위반을 Finding 으로 변환 (자체 룰과 중복되지 않도록 axe.* 접두) */
export function axeToFindings(violations: AxeViolationLike[]): Finding[] {
  const out: Finding[] = [];
  for (const v of violations) {
    const targets = v.nodes && v.nodes.length > 0 ? v.nodes : [{ target: [v.id] }];
    for (const n of targets) {
      const nodeId = n.target?.join(' ') ?? v.id;
      out.push({
        ruleId: `axe.${v.id}`,
        standard: ['WCAG2.2'],
        criterion: v.help ?? v.id,
        status: 'fail',
        severity: SEV_MAP[v.impact ?? 'moderate'] ?? 'moderate',
        source: 'auto',
        confidence: 'high',
        nodeId,
        nodeName: nodeId,
        message: v.description ?? v.help ?? `axe 규칙 위반: ${v.id}`,
        evidence: { axeRule: v.id, impact: v.impact },
      });
    }
  }
  return out;
}

/** DOM 스냅샷 → ScanResult (자체 룰 + 선택적 axe 병합) */
export function scanSnapshot(snapshot: DomSnapshot, opts: ScanServiceOptions = {}): ScanResult {
  const nodes = snapshotToA11yNodes(snapshot);
  const result = scanNodes(nodes, { palette: opts.palette });
  if (opts.axeViolations && opts.axeViolations.length > 0) {
    const axe = axeToFindings(opts.axeViolations);
    const findings = [...result.findings, ...axe];
    return { findings, summary: recountSummary(findings, result.summary.estimatedPassRateLabel) };
  }
  return result;
}

function recountSummary(findings: Finding[], label: string): ScanResult['summary'] {
  let pass = 0;
  let fail = 0;
  let manual = 0;
  for (const f of findings) {
    if (f.status === 'pass') pass++;
    else if (f.status === 'fail') fail++;
    else manual++;
  }
  const autoTotal = pass + fail;
  return {
    pass,
    fail,
    manual,
    total: findings.length,
    estimatedPassRate: autoTotal === 0 ? 1 : pass / autoTotal,
    estimatedPassRateLabel: label,
  };
}
