import type { StandardId, Severity } from '@app/rules-data';

export type { StandardId, Severity };

/** 입력을 플랫폼 무관하게 표현하는 정규화 노드 */
export interface A11yNode {
  id: string;
  type: 'text' | 'button' | 'input' | 'image' | 'container' | 'icon' | 'link';
  name?: string;

  // 시각 속성 (정규화)
  fgColor?: string; // hex, 텍스트/전경색
  bgColor?: string; // hex, 유효 배경색(상속 해석 후) — 단일색
  /**
   * A1: 유효 배경이 여러 색일 때(그라데이션 stop, 겹친 반투명 레이어 블렌딩 결과)
   * 평가할 후보 배경색들. 존재하면 **최악(worst-case) 대비**로 판정한다.
   * bgColor 보다 우선.
   */
  bgColors?: string[];
  fontSizePx?: number;
  fontWeight?: number;
  bold?: boolean;
  lineHeightPx?: number; // A2: 행간 (px)
  letterSpacingPx?: number; // A2: 자간 (px)
  textDecoration?: 'none' | 'underline' | 'line-through' | 'overline'; // A2: link.identifiable
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

  /**
   * A3: 의미 속성(alt/label/focus 등)이 신뢰 가능한 소스에서 왔는지.
   * Figma 처럼 레이어명 휴리스틱으로 추론한 경우 false → 해당 판정은 confidence 'low'.
   * 미지정/true = 신뢰 가능(HTML DOM 등).
   */
  semanticsReliable?: boolean;

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
  /** A3: 판정 신뢰도. 휴리스틱 기반(저신뢰)은 사람 확인 권장. 미지정=high. */
  confidence?: 'high' | 'medium' | 'low';
  confidenceReason?: string;
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
  /**
   * B1: 색 보정 시 우선 선택할 디자인 시스템 팔레트(hex 목록).
   * 통과하는 팔레트 색이 있으면 임의 색 대신 그 색을 채택해 토큰 일관성 유지.
   */
  palette?: string[];
}

export interface Rule {
  id: string;
  /** 이 룰이 해당 노드에 적용되는지 */
  appliesTo(node: A11yNode): boolean;
  /** 단일 노드 판정 */
  evaluate(node: A11yNode, ctx: RuleContext): Finding | null;
}
