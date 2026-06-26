import type { ScanResult, Finding } from './types';

export interface ReportBreakdown {
  auto: number;
  aiAssisted: number;
  manual: number;
}

export interface A11yReport {
  generatedNote: string;
  summary: ScanResult['summary'];
  /** 판정 출처별 집계 (가드레일 5장: auto/ai-assisted/manual 구분 표기 필수) */
  breakdown: ReportBreakdown;
  bySeverity: Record<Finding['severity'], number>;
  findings: Finding[];
}

const GUARDRAIL_NOTE =
  '본 리포트는 자동 판정 가능한 항목 기준이며, 전체 접근성 준수를 보장하지 않습니다. ' +
  '보정은 항목별로 사람이 검토·수락 후 적용됩니다.';

/** ScanResult → 직렬화 가능한 JSON 리포트 (6.5 작업7) */
export function buildReport(result: ScanResult): A11yReport {
  const breakdown: ReportBreakdown = { auto: 0, aiAssisted: 0, manual: 0 };
  const bySeverity: Record<Finding['severity'], number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const f of result.findings) {
    if (f.source === 'auto') breakdown.auto++;
    else if (f.source === 'ai-assisted') breakdown.aiAssisted++;
    else breakdown.manual++;
    if (f.status === 'fail') bySeverity[f.severity]++;
  }
  return {
    generatedNote: GUARDRAIL_NOTE,
    summary: result.summary,
    breakdown,
    bySeverity,
    findings: result.findings,
  };
}

export function reportToJson(result: ScanResult): string {
  return JSON.stringify(buildReport(result), null, 2);
}

/** 사람이 읽는 텍스트 요약 (PNG/공유 카드 캡션용 소스) */
export function reportToText(result: ScanResult): string {
  const r = buildReport(result);
  const rate = Math.round(r.summary.estimatedPassRate * 100);
  return [
    `접근성 진단 요약`,
    `합격 ${r.summary.pass} · 불합격 ${r.summary.fail} · 수동확인 ${r.summary.manual}`,
    `예상 통과율 ${rate}% (${r.summary.estimatedPassRateLabel})`,
    `판정 출처 — 자동 ${r.breakdown.auto} / AI보조 ${r.breakdown.aiAssisted} / 수동 ${r.breakdown.manual}`,
    `불합격 심각도 — critical ${r.bySeverity.critical}, serious ${r.bySeverity.serious}, moderate ${r.bySeverity.moderate}, minor ${r.bySeverity.minor}`,
    ``,
    r.generatedNote,
  ].join('\n');
}
