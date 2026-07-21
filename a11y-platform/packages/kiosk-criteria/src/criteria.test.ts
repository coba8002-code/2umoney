import { describe, it, expect } from 'vitest';
import {
  criteria,
  getCriterion,
  criteriaByModality,
  criterionForA11yRule,
  baselineCriteria,
  measurementRequired,
  coverage,
} from './index';

describe('키오스크 기준 DB — 무결성', () => {
  it('id 는 고유하다', () => {
    const ids = criteria.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 항목에 근거 조항·모달리티·출처가 있다', () => {
    for (const c of criteria) {
      expect(c.clause.length).toBeGreaterThan(0);
      expect(c.modality.length).toBeGreaterThan(0);
      expect(['auto', 'ai-assisted', 'manual']).toContain(c.source);
    }
  });

  it('measure 모달리티 항목은 실측 필요로 표기된다', () => {
    for (const c of criteria) {
      if (c.modality.includes('measure')) expect(c.needsMeasurement).toBe(true);
    }
  });

  it('임계값이 있는 대표 항목 확인 (MBR 12mm/144mm², 대비 4.5, 타임아웃 20s, 문자 7.25mm)', () => {
    expect(getCriterion('kiosk.button.mbr')?.thresholds).toMatchObject({ minSideMm: 12, minAreaMm2: 144 });
    expect(getCriterion('kiosk.contrast')?.thresholds?.minRatio).toBe(4.5);
    expect(getCriterion('kiosk.time.limit')?.thresholds?.warnBeforeSec).toBe(20);
    expect(getCriterion('kiosk.text.size')?.thresholds?.minCharHeightMm).toBe(7.25);
  });
});

describe('키오스크 기준 DB — 엔진 연결·조회', () => {
  it('기존 @app/core 룰과 매핑된다', () => {
    expect(criterionForA11yRule('contrast.text')?.id).toBe('kiosk.contrast');
    expect(criterionForA11yRule('target.size')?.id).toBe('kiosk.button.mbr');
    expect(criterionForA11yRule('link.identifiable')?.id).toBe('kiosk.color.independence');
  });

  it('모달리티별 조회', () => {
    expect(criteriaByModality('vision').length).toBeGreaterThan(3);
    expect(criteriaByModality('llm').some((c) => c.id === 'kiosk.language.plain')).toBe(true);
  });

  it('기본 항목·실측필요 항목 조회', () => {
    expect(baselineCriteria().length).toBeGreaterThan(0);
    expect(measurementRequired().some((c) => c.id === 'kiosk.button.mbr')).toBe(true);
  });

  it('커버리지 리포트', () => {
    const cov = coverage();
    expect(cov.total).toBe(criteria.length);
    expect(cov.withEngineRule).toBeGreaterThanOrEqual(5); // 이미 엔진에 연결된 기준 수
  });
});
