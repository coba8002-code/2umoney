/**
 * JUX 키오스크 접근성 기준 DB 타입.
 * 별표5(검증기준) + KS X 9211:2025(지침) + XLSX(AI 항목·기술 매핑)를 정형화한다.
 */

/** 진단을 담당하는 AI/방법 모달리티 */
export type Modality = 'vision' | 'ocr' | 'speech' | 'ui-flow' | 'video' | 'llm' | 'measure';

/** 판정 출처 — 컴플라이언스 가드레일(항상 표기) */
export type CriterionSource = 'auto' | 'ai-assisted' | 'manual';

export type CriterionCategory = 'hand' | 'response' | 'sight' | 'hearing' | 'cognition' | 'io';

/** 별표5 판정 등급(우수/보통) — 있는 항목만 */
export type Grade = '우수' | '보통';

export interface KioskCriterion {
  id: string;
  /** 근거 조항(별표5 / KS X 9211 / XLSX 원본행) */
  clause: string[];
  category: CriterionCategory;
  /** '기본'=반드시 평가, '해당시'=해당 사항이 있을 때만 */
  level: '기본' | '해당시';
  titleKo: string;
  /** 요건(원문 패러프레이즈) */
  requirement: string;
  /** 적합/부적합 판정 */
  judgment: 'pass-fail';
  grades?: Grade[];
  gradeRule?: string;
  /** 이 기준을 진단하는 모달리티(복수) */
  modality: Modality[];
  /** 기존 @app/core 룰과 연결되면 그 ruleId (없으면 null/미지정) */
  a11yRuleId?: string | null;
  /** 구조화 임계값(mm·비율·초 등) */
  thresholds?: Record<string, number>;
  source: CriterionSource;
  /** 이미지만으로 확정 불가 → 실측/기준 마커 필요 */
  needsMeasurement: boolean;
}

export interface KioskCriteriaDb {
  version: string;
  standard: Record<string, string>;
  modalityLabels: Record<Modality, string>;
  categoryLabels: Record<CriterionCategory, string>;
  criteria: KioskCriterion[];
}
