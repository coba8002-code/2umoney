import { describe, it, expect, vi } from 'vitest';
import { ClaudeAltProvider, createAltProvider, HeuristicAltProvider } from '../index';

/** Anthropic.messages.create 를 흉내내는 가짜 클라이언트 */
function mockClient(text: string) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text }],
  });
  return { client: { messages: { create } as any }, create };
}

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('C2 — ClaudeAltProvider (멀티모달)', () => {
  it('이미지를 base64 image 블록으로 전달한다', async () => {
    const { client, create } = mockClient(
      '{"alt":"한라산 정상","isDecorative":false,"confidence":0.8,"rationale":"산 풍경"}',
    );
    const provider = new ClaudeAltProvider({ client });
    const res = await provider.suggestAltText({ nodeId: 'x', name: 'photo', dataUrl: PNG_1PX });

    expect(res.alt).toBe('한라산 정상');
    expect(res.confidence).toBe(0.8);
    expect(res.isDecorative).toBe(false);

    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe('claude-opus-4-8');
    // 4.8 에서 제거된 샘플링 파라미터를 전달하지 않는다
    expect(arg.temperature).toBeUndefined();
    const content = arg.messages[0].content;
    const imageBlock = content.find((b: any) => b.type === 'image');
    expect(imageBlock.source.type).toBe('base64');
    expect(imageBlock.source.media_type).toBe('image/png');
    expect(imageBlock.source.data).not.toContain('data:');
  });

  it('JSON 파싱 실패 시 낮은 신뢰도로 안전하게 폴백한다', async () => {
    const { client } = mockClient('죄송하지만 이미지를 볼 수 없습니다.');
    const provider = new ClaudeAltProvider({ client });
    const res = await provider.suggestAltText({ nodeId: 'x', name: 'photo' });
    expect(res.confidence).toBeLessThan(0.2);
    expect(res.alt).toBe('');
  });

  it('텍스트 앞뒤 잡음이 있어도 JSON 객체를 추출한다', async () => {
    const { client } = mockClient(
      '네, 다음과 같습니다:\n{"verdict":"fail","rationale":"링크 텍스트가 모호함","confidence":0.7}\n도움이 되었길 바랍니다.',
    );
    const provider = new ClaudeAltProvider({ client });
    const res = await provider.assessContextual(
      { id: 'n', type: 'link', name: '여기' },
      { id: 'link.identifiable', criterion: 'WCAG 2.4.4' },
    );
    expect(res.verdict).toBe('fail');
    expect(res.confidence).toBe(0.7);
  });

  it('알 수 없는 verdict 는 unsure 로 정규화한다', async () => {
    const { client } = mockClient('{"verdict":"maybe","rationale":"x","confidence":0.5}');
    const provider = new ClaudeAltProvider({ client });
    const res = await provider.assessContextual(
      { id: 'n', type: 'link' },
      { id: 'r', criterion: 'WCAG 2.4.4' },
    );
    expect(res.verdict).toBe('unsure');
  });
});

describe('C2 — createAltProvider 팩토리', () => {
  it('주입된 client 가 있으면 ClaudeAltProvider 를 반환', () => {
    const { client } = mockClient('{}');
    expect(createAltProvider({ client })).toBeInstanceOf(ClaudeAltProvider);
  });

  it('apiKey 가 있으면 ClaudeAltProvider 를 반환', () => {
    expect(createAltProvider({ apiKey: 'sk-test' })).toBeInstanceOf(ClaudeAltProvider);
  });

  it('키도 client 도 없으면 결정론 폴백(Heuristic)을 반환', () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(createAltProvider()).toBeInstanceOf(HeuristicAltProvider);
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});
