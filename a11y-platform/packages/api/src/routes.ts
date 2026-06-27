/**
 * D: REST 핸들러 (프레임워크 무관 순수 함수, 스펙 7.4).
 * Fastify/Express 등 어떤 서버에서도 이 함수를 호출해 라우팅하면 된다.
 *   POST /v1/scan   { source, payload } -> ScanResult
 *   POST /v1/fix    { scanResult, acceptRuleIds[] } -> { diff, }
 *   GET  /v1/report (body: ScanResult) -> A11yReport
 */
import { buildReport, type ScanResult, type A11yReport, type Finding } from '@app/core';
import { scanSnapshot, type ScanServiceOptions } from './scanService';
import type { DomSnapshot } from './htmlAdapter';

export interface ScanRequest {
  source: 'html' | 'url' | 'figma';
  payload: {
    /** source='html': 브라우저가 직렬화한 스냅샷 (collect.ts 산출물) */
    snapshot?: DomSnapshot;
    /** source='url': 수집은 서버의 Playwright 콜렉터가 담당 */
    url?: string;
    options?: ScanServiceOptions;
  };
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export function handleScan(req: ScanRequest): ApiResult<ScanResult> {
  if (req.source === 'html') {
    if (!req.payload.snapshot) return { ok: false, status: 400, error: 'payload.snapshot 이 필요합니다.' };
    return { ok: true, status: 200, data: scanSnapshot(req.payload.snapshot, req.payload.options) };
  }
  if (req.source === 'url') {
    // URL 수집은 헤드리스 브라우저가 필요 → 서버 런타임에서 collect() 후 handleScan({source:'html'}) 호출
    return { ok: false, status: 501, error: "source='url' 은 서버 런타임의 collect() 로 스냅샷을 만든 뒤 source='html' 로 호출하세요." };
  }
  return { ok: false, status: 501, error: "source='figma' 는 /v1/figma/scan 을 사용하세요." };
}

export interface FixDiffEntry {
  nodeId: string;
  ruleId: string;
  kind: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  styleImpact: string;
  rationale: string;
}

/** 수락한 룰의 결정론 보정 diff 를 산출 (실제 소스 반영은 클라이언트가 적용) */
export function handleFix(scanResult: ScanResult, acceptRuleIds: string[]): ApiResult<{ diff: FixDiffEntry[] }> {
  const accept = new Set(acceptRuleIds);
  const diff: FixDiffEntry[] = [];
  for (const f of scanResult.findings as Finding[]) {
    if (f.status !== 'fail' || !f.fix) continue;
    if (!accept.has(f.ruleId)) continue;
    diff.push({
      nodeId: f.nodeId,
      ruleId: f.ruleId,
      kind: f.fix.kind,
      before: f.fix.before,
      after: f.fix.after,
      styleImpact: f.fix.styleImpact,
      rationale: f.fix.rationale,
    });
  }
  return { ok: true, status: 200, data: { diff } };
}

export function handleReport(scanResult: ScanResult): ApiResult<A11yReport> {
  return { ok: true, status: 200, data: buildReport(scanResult) };
}
