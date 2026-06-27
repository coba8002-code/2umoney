import { describe, it, expect } from 'vitest';
import { figmaFileToA11yNodes, figmaColorToHex, parseFigmaFileKey, type FigmaRestNode } from '../figmaRestAdapter';
import { scanNodes, contrastRatio, type Finding } from '@app/core';

const find = (fs: Finding[], ruleId: string) => fs.filter((f) => f.ruleId === ruleId);

describe('Figma REST 어댑터', () => {
  it('figmaColorToHex 변환', () => {
    expect(figmaColorToHex({ r: 1, g: 0, b: 0 })).toBe('#ff0000');
    expect(figmaColorToHex({ r: 0.1, g: 0.46667, b: 0 })).toBe('#1a7700');
  });

  it('parseFigmaFileKey 추출', () => {
    expect(parseFigmaFileKey('https://www.figma.com/design/abc123XYZ/My-File?node-id=1')).toBe('abc123XYZ');
    expect(parseFigmaFileKey('https://figma.com/file/KEY99/Title')).toBe('KEY99');
    expect(parseFigmaFileKey('https://example.com')).toBeNull();
  });

  const DOC: FigmaRestNode = {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Page 1',
        type: 'CANVAS',
        children: [
          {
            id: '1:1',
            name: 'Card',
            type: 'FRAME',
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            absoluteBoundingBox: { width: 300, height: 200 },
            children: [
              {
                id: '1:2',
                name: '설명',
                type: 'TEXT',
                characters: '연회색 본문',
                fills: [{ type: 'SOLID', color: { r: 0.67, g: 0.67, b: 0.67 } }],
                style: { fontSize: 14, fontWeight: 400 },
                absoluteBoundingBox: { width: 200, height: 20 },
              },
              {
                id: '1:3',
                name: '구매 버튼',
                type: 'FRAME',
                fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.46, b: 0.82 } }],
                absoluteBoundingBox: { width: 30, height: 28 },
                children: [
                  { id: '1:4', name: 'label', type: 'TEXT', characters: '구매', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }], style: { fontSize: 14 }, absoluteBoundingBox: { width: 20, height: 16 } },
                ],
              },
              { id: '1:5', name: '대표 이미지', type: 'RECTANGLE', fills: [{ type: 'IMAGE' }], absoluteBoundingBox: { width: 300, height: 120 } },
            ],
          },
        ],
      },
    ],
  };

  it('document → A11yNode 트리 변환 후 코어 스캔', () => {
    const nodes = figmaFileToA11yNodes(DOC);
    const { findings } = scanNodes(nodes);

    // 연회색 텍스트 대비 미달 + 보정 재검증
    const c = find(findings, 'contrast.text').find((f) => f.nodeName === '설명')!;
    expect(c.status).toBe('fail');
    expect(contrastRatio(c.fix!.after.fgColor as string, '#ffffff')).toBeGreaterThanOrEqual(4.5 - 0.01);

    // 작은 버튼(30x28) target.size fail
    expect(find(findings, 'target.size').some((f) => f.status === 'fail')).toBe(true);

    // 이미지 alt 누락
    expect(find(findings, 'img.alt').some((f) => f.status === 'fail')).toBe(true);

    // Figma 의미정보는 휴리스틱 → 신뢰도 low
    const alt = find(findings, 'img.alt').find((f) => f.status === 'fail')!;
    expect(alt.confidence).toBe('low');
  });

  it('TEXT 의 fill 은 전경, FRAME 의 fill 은 배경으로 해석', () => {
    const [page] = figmaFileToA11yNodes(DOC);
    const card = page.children![0];
    const desc = card.children!.find((n) => n.name === '설명')!;
    expect(desc.fgColor).toBe('#ababab');
    expect(desc.bgColor).toBe('#ffffff'); // 카드 프레임 배경 상속
  });
});
