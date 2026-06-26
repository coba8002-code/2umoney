import type { StandardId, Severity } from '@app/rules-data';

export type { StandardId, Severity };

/** 입력을 플랫폼 무관하게 표현하는 정규화 노드 */
export interface A11yNode {
  id: string;
  type: 'text' | 'button' | 'input' | 'image' | 'container' | 'icon' | 'link';
  name?: string;

  // 시각 속성 (정규화)
  fgColor?: string; // hex, 텍스트/전경색
  bgColor?: string; // hex, 유효 배경색(상속 해석 후)
  fontSizePx?: number;
  fontWeight?: number;
  bold?: boolean;
  width?: number;
  height?: number; // px

  // 의미 속성
  altText?: string | null; // 대체텍스트 (null=없음, ''=빈값)
  label?: string | null; // 연결된 레이블
  role?: string;
  decorative?: boolean; // 장식용 이미지 여부 (alt 면제)
  focusable?: boolean;
  hasVisibleFocusStyle?: boolean;
  headingLevel?: number; // h1=1 ... (HTML)

  children?: A11yNode[];
  raw?: unknown; // 어댑터별 원본 핸들(Figma node, DOM el)
}

export type FindingStatus = 'pass' | 'fail' | 'manual';

export interface FixSuggestion {
  kind: 'color' | 'fontSize' | 'touchTarget' | 'altText' | 'aria' | 'focusStyle';
  before: Record<string, unknown>;
  after: Record<string, unknown>; // 적용 제안값
  styleImpact: 'none' | 'minimal' | 'visible';
  rationale: string;
}

export interface Finding {
  ruleId: string; // 'contrast.text', 'img.alt' ...
  standard: StandardId[];
  criterion: string; // 예: 'KWCAG 5.3.1 / WCAG 1.4.3'
  status: FindingStatus; // manual = 사람 확인 필요
  severity: Severity;
  /** 판정 출처 — 컴플라이언스 가드레일(5장)을 위해 항상 명시 */
  source: 'auto' | 'ai-assisted' | 'manual';
  nodeId: string;
  nodeName?: string;
  message: string; // 한국어 설명
  evidence?: Record<string, unknown>; // {ratio: 2.9, required: 4.5}
  fix?: FixSuggestion; // 자동 보정 가능 시
}

export interface ScanSummary {
  pass: number;
  fail: number;
  manual: number;
  total: number;
  /** "자동판정 가능 항목 기준" 통과율. 전체 접근성 보장이 아님(5장 가드레일). */
  estimatedPassRate: number;
  estimatedPassRateLabel: string;
}

export interface ScanResult {
  findings: Finding[];
  summary: ScanSummary;
}

export interface RuleContext {
  /** 룰별 임계값 등 설정 오버라이드 (없으면 rules-data 기본값) */
  params?: Record<string, number>;
}

export interface Rule {
  id: string;
  /** 이 룰이 해당 노드에 적용되는지 */
  appliesTo(node: A11yNode): boolean;
  /** 단일 노드 판정 */
  evaluate(node: A11yNode, ctx: RuleContext): Finding | null;
}
