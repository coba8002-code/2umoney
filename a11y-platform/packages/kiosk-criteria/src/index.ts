/**
 * @app/kiosk-criteria — JUX 키오스크 접근성 기준 DB (단일 소스).
 * criteria.json 을 로드해 조회 헬퍼를 제공한다.
 */
import raw from '../criteria.json';
import type {
  KioskCriteriaDb,
  KioskCriterion,
  Modality,
  CriterionCategory,
  CriterionSource,
} from './types';

export * from './types';

export const db: KioskCriteriaDb = raw as unknown as KioskCriteriaDb;
export const criteria: KioskCriterion[] = db.criteria;

const byId = new Map(criteria.map((c) => [c.id, c]));

export function getCriterion(id: string): KioskCriterion | undefined {
  return byId.get(id);
}

export function criteriaByModality(m: Modality): KioskCriterion[] {
  return criteria.filter((c) => c.modality.includes(m));
}

export function criteriaByCategory(cat: CriterionCategory): KioskCriterion[] {
  return criteria.filter((c) => c.category === cat);
}

export function criteriaBySource(s: CriterionSource): KioskCriterion[] {
  return criteria.filter((c) => c.source === s);
}

/** 기존 @app/core 룰 id 로 연결된 키오스크 기준 조회 */
export function criterionForA11yRule(ruleId: string): KioskCriterion | undefined {
  return criteria.find((c) => c.a11yRuleId === ruleId);
}

/** '기본' 필수 항목만 */
export function baselineCriteria(): KioskCriterion[] {
  return criteria.filter((c) => c.level === '기본');
}

/** 이미지만으로 확정 불가(실측/기준 마커 필요) 항목 */
export function measurementRequired(): KioskCriterion[] {
  return criteria.filter((c) => c.needsMeasurement);
}

/** 자동 판정 가능(우리 엔진에 룰이 연결된) 비율 — 커버리지 리포트용 */
export function coverage(): { total: number; withEngineRule: number; aiAssisted: number; manual: number } {
  return {
    total: criteria.length,
    withEngineRule: criteria.filter((c) => !!c.a11yRuleId).length,
    aiAssisted: criteria.filter((c) => c.source === 'ai-assisted').length,
    manual: criteria.filter((c) => c.source === 'manual').length,
  };
}
