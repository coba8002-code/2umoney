/**
 * C1: AI 계층 프로바이더 추상화 (스펙 7.3).
 * 색·레이아웃은 결정론 코드가 담당하고, AI 는 텍스트/판단 보조에만 사용한다.
 * 실제 멀티모달 LLM(Claude 등)은 이 인터페이스를 구현해 교체 가능하게 한다.
 */
import type { A11yNode } from '@app/core';

export interface ImageContext {
  nodeId: string;
  /** 레이어/파일명 등 식별 힌트 */
  name?: string;
  /** 이미지 주변 텍스트(캡션·인접 문단) */
  surroundingText?: string;
  /** 이미지 래스터(base64 data URL) — 멀티모달 입력용 (옵션) */
  dataUrl?: string;
  /** 링크/버튼 내부 이미지 등 역할 힌트 */
  role?: string;
}

export interface AltSuggestion {
  /** 제안 대체텍스트 (장식이면 '') */
  alt: string;
  /** 0~1 신뢰도 */
  confidence: number;
  /** 장식용으로 판단되면 true → 빈 alt 권장 */
  isDecorative: boolean;
  /** 판단 근거 (사람 검토용) */
  rationale: string;
}

export interface Rule {
  id: string;
  criterion: string;
}

export interface AssessResult {
  verdict: 'pass' | 'fail' | 'unsure';
  rationale: string;
  confidence: number;
}

export interface LlmProvider {
  /** 대체텍스트 적절성 평가 + 생성 제안 (이미지+문맥) */
  suggestAltText(img: ImageContext): Promise<AltSuggestion>;
  /** 맥락 판단형 항목 1차 평가 → manual 가이드 구체화 */
  assessContextual(node: A11yNode, rule: Rule): Promise<AssessResult>;
}
