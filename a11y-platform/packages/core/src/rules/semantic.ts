import type { Rule } from '../types';
import { makeFinding } from './helpers';

const hasText = (s: string | null | undefined): boolean => typeof s === 'string' && s.trim().length > 0;

/** img.alt — 이미지 대체텍스트 유무 (장식 제외). 보정: AI 생성 제안 */
export const imgAltRule: Rule = {
  id: 'img.alt',
  appliesTo: (n) => n.type === 'image',
  evaluate(node) {
    if (node.decorative) {
      return makeFinding('img.alt', node, 'pass', '장식용 이미지로 표시되어 대체텍스트가 면제됩니다.', {
        source: 'auto',
        evidence: { decorative: true },
      });
    }
    if (hasText(node.altText)) {
      // 존재는 자동 판정, 적절성(맥락 일치)은 사람/AI 확인 필요
      return makeFinding('img.alt', node, 'pass', `대체텍스트 존재("${node.altText}"). 적절성은 검토 권장.`, {
        source: 'auto',
        evidence: { altText: node.altText },
      });
    }
    return makeFinding('img.alt', node, 'fail', '이미지에 대체텍스트가 없습니다.', {
      source: 'ai-assisted',
      evidence: { altText: node.altText ?? null },
      fix: {
        kind: 'altText',
        before: { altText: node.altText ?? null },
        after: { altText: '' }, // 실제 값은 Phase 2 AI(suggestAltText)가 채움
        styleImpact: 'none',
        rationale: 'AI 대체텍스트 생성 후 사람이 적절성을 검토·수락합니다. (장식이면 빈 alt 처리)',
      },
    });
  },
};

/** control.label — 버튼/입력의 접근 가능한 이름 (보정: AI 생성) */
export const controlLabelRule: Rule = {
  id: 'control.label',
  appliesTo: (n) => n.type === 'button' || n.type === 'input',
  evaluate(node) {
    const accName = hasText(node.label) || hasText(node.altText) || (node.type === 'button' && hasText(node.name));
    if (accName) {
      return makeFinding('control.label', node, 'pass', '접근 가능한 이름이 존재합니다.', {
        source: 'auto',
        evidence: { label: node.label ?? node.name ?? null },
      });
    }
    return makeFinding(
      'control.label',
      node,
      'fail',
      `${node.type === 'input' ? '입력 필드' : '버튼'}에 연결된 레이블/접근 가능한 이름이 없습니다.`,
      {
        source: 'ai-assisted',
        evidence: { label: node.label ?? null },
        fix: {
          kind: 'aria',
          before: { label: node.label ?? null },
          after: { label: '' },
          styleImpact: 'none',
          rationale: '레이블 또는 aria-label 을 추가합니다. AI 제안 후 사람이 수락합니다.',
        },
      },
    );
  },
};

/** focus.visible — 가시적 포커스 스타일 존재 (보정: 스타일) */
export const focusVisibleRule: Rule = {
  id: 'focus.visible',
  appliesTo: (n) => n.focusable === true,
  evaluate(node) {
    if (node.hasVisibleFocusStyle) {
      return makeFinding('focus.visible', node, 'pass', '가시적 포커스 스타일이 존재합니다.', {
        evidence: { hasVisibleFocusStyle: true },
      });
    }
    return makeFinding('focus.visible', node, 'fail', '키보드 포커스 시 가시적 표시가 없습니다.', {
      evidence: { hasVisibleFocusStyle: false },
      fix: {
        kind: 'focusStyle',
        before: { hasVisibleFocusStyle: false },
        after: { hasVisibleFocusStyle: true, outline: '2px solid (대비 3:1 이상)' },
        styleImpact: 'minimal',
        rationale: '포커스 표시(아웃라인/링)를 추가합니다. 비포커스 상태 디자인에는 영향 없음.',
      },
    });
  },
};
