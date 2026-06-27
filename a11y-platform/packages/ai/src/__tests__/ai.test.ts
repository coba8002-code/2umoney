import { describe, it, expect } from 'vitest';
import { scanNodes, type A11yNode } from '@app/core';
import { HeuristicAltProvider, enrichAltSuggestions } from '../index';

const provider = new HeuristicAltProvider();

describe('C1 — HeuristicAltProvider', () => {
  it('장식 힌트 레이어명은 장식으로 판단(빈 alt)', async () => {
    const s = await provider.suggestAltText({ nodeId: 'x', name: 'bg-gradient-배경' });
    expect(s.isDecorative).toBe(true);
    expect(s.alt).toBe('');
  });

  it('주변 텍스트가 있으면 신뢰도가 더 높다', async () => {
    const withCtx = await provider.suggestAltText({ nodeId: 'x', name: 'photo', surroundingText: '제주 한라산 풍경' });
    const nameOnly = await provider.suggestAltText({ nodeId: 'x', name: 'photo' });
    expect(withCtx.confidence).toBeGreaterThan(nameOnly.confidence);
  });

  it('근거가 없으면 매우 낮은 신뢰도', async () => {
    const s = await provider.suggestAltText({ nodeId: 'x' });
    expect(s.confidence).toBeLessThan(0.2);
  });

  it('assessContextual 은 단정하지 않고 unsure', async () => {
    const r = await provider.assessContextual({ id: 'n', type: 'link' }, { id: 'link.identifiable', criterion: 'WCAG 1.4.1' });
    expect(r.verdict).toBe('unsure');
  });
});

describe('C1 — enrichAltSuggestions', () => {
  it('img.alt fail 에 AI 제안을 채우고 출처를 ai-assisted 로 표기', async () => {
    const node: A11yNode = { id: 'hero', type: 'image', name: '한라산 사진', altText: null };
    const { findings } = scanNodes([node]);
    const enriched = await enrichAltSuggestions(findings, provider, {
      contexts: { hero: { nodeId: 'hero', name: '한라산 사진', surroundingText: '제주 여행' } },
    });
    const f = enriched.find((x) => x.ruleId === 'img.alt')!;
    expect(f.source).toBe('ai-assisted');
    expect(typeof f.fix!.after.altText).toBe('string');
    expect(f.confidence).toBeTruthy();
    expect(f.confidenceReason).toBeTruthy();
  });

  it('img.alt 외 항목은 변경하지 않는다', async () => {
    const node: A11yNode = { id: 't', type: 'text', fgColor: '#999', bgColor: '#fff', fontSizePx: 16 };
    const { findings } = scanNodes([node]);
    const enriched = await enrichAltSuggestions(findings, provider);
    const contrast = enriched.find((x) => x.ruleId === 'contrast.text')!;
    expect(contrast.source).toBe('auto');
  });

  it('장식 판단 시 빈 alt 를 제안하고 메시지에 명시', async () => {
    const node: A11yNode = { id: 'deco', type: 'image', name: 'divider 구분선', altText: null };
    const { findings } = scanNodes([node]);
    const enriched = await enrichAltSuggestions(findings, provider);
    const f = enriched.find((x) => x.ruleId === 'img.alt')!;
    expect(f.fix!.after.isDecorative).toBe(true);
    expect(f.fix!.after.altText).toBe('');
  });
});
