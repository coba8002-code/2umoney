/**
 * C1: 네트워크 없이 동작하는 결정론적 프로바이더.
 * 실제 LLM 연동(Phase 2) 전의 기본 구현이자, LLM 실패 시 폴백.
 * 레이어명·주변 텍스트 등 구조 신호만으로 보수적인 제안을 만든다.
 */
import type { A11yNode } from '@app/core';
import type { LlmProvider, ImageContext, AltSuggestion, AssessResult, Rule } from './provider';

const DECORATIVE_HINT = /(^|[\s_\-/])(bg|background|배경|deco|decoration|장식|divider|구분선|spacer|gradient|그라데이션|pattern|ornament)([\s_\-/]|$)/i;
const NOISE = /\.(png|jpe?g|svg|webp|gif)$|[_\-]/gi;

function cleanName(name?: string): string {
  if (!name) return '';
  return name.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
}

export class HeuristicAltProvider implements LlmProvider {
  async suggestAltText(img: ImageContext): Promise<AltSuggestion> {
    const name = img.name ?? '';
    if (DECORATIVE_HINT.test(name)) {
      return {
        alt: '',
        confidence: 0.6,
        isDecorative: true,
        rationale: '레이어명이 장식 요소를 시사합니다. 의미 전달이 없다면 빈 alt(장식)로 처리하세요.',
      };
    }

    // 주변 텍스트가 있으면 더 신뢰도 높은 제안
    const surrounding = (img.surroundingText ?? '').trim();
    const base = cleanName(name);
    if (surrounding) {
      const short = surrounding.length > 60 ? surrounding.slice(0, 60) + '…' : surrounding;
      return {
        alt: base ? `${base}` : short,
        confidence: 0.5,
        isDecorative: false,
        rationale: `주변 텍스트("${short}")와 레이어명을 근거로 한 초안입니다. 이미지 실제 내용과 일치하는지 검토하세요.`,
      };
    }

    if (base) {
      return {
        alt: base,
        confidence: 0.35,
        isDecorative: false,
        rationale: '레이어명만으로 생성한 약한 초안입니다. 반드시 사람이 확인·수정하세요.',
      };
    }

    return {
      alt: '',
      confidence: 0.1,
      isDecorative: false,
      rationale: '근거 신호가 부족합니다. 이미지 내용을 직접 보고 대체텍스트를 작성하세요.',
    };
  }

  async assessContextual(node: A11yNode, rule: Rule): Promise<AssessResult> {
    // 결정론 폴백은 단정하지 않는다 — 항상 사람 확인 유도
    return {
      verdict: 'unsure',
      rationale: `${rule.criterion} 항목은 맥락 판단이 필요합니다. 자동 판정만으로 결론내리지 말고 검토하세요. (대상: ${node.name ?? node.id})`,
      confidence: 0.2,
    };
  }
}
