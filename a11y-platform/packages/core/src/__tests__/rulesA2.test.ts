import { describe, it, expect } from 'vitest';
import { scanNodes } from '../engine';
import type { A11yNode, Finding } from '../types';

const find = (fs: Finding[], ruleId: string) => fs.filter((f) => f.ruleId === ruleId);

describe('A2 — text.lineHeight', () => {
  it('행간 비율 1.5 미만이면 fail', () => {
    const n: A11yNode = { id: 't', type: 'text', fontSizePx: 16, lineHeightPx: 18 }; // 1.125
    const f = find(scanNodes([n]).findings, 'text.lineHeight')[0];
    expect(f.status).toBe('fail');
    expect(f.evidence?.recommendedPx).toBe(24);
  });
  it('행간 비율 1.5 이상이면 pass', () => {
    const n: A11yNode = { id: 't', type: 'text', fontSizePx: 16, lineHeightPx: 24 };
    expect(find(scanNodes([n]).findings, 'text.lineHeight')[0].status).toBe('pass');
  });
  it('행간 정보 없으면 룰 미적용', () => {
    const n: A11yNode = { id: 't', type: 'text', fontSizePx: 16 };
    expect(find(scanNodes([n]).findings, 'text.lineHeight')).toHaveLength(0);
  });
});

describe('A2 — text.letterSpacing', () => {
  it('과도한 음수 자간은 fail', () => {
    const n: A11yNode = { id: 't', type: 'text', fontSizePx: 20, letterSpacingPx: -4 }; // -0.2em
    expect(find(scanNodes([n]).findings, 'text.letterSpacing')[0].status).toBe('fail');
  });
  it('정상 자간은 pass', () => {
    const n: A11yNode = { id: 't', type: 'text', fontSizePx: 20, letterSpacingPx: 0 };
    expect(find(scanNodes([n]).findings, 'text.letterSpacing')[0].status).toBe('pass');
  });
});

describe('A2 — link.identifiable', () => {
  it('밑줄 없는 링크는 fail (색 의존)', () => {
    const n: A11yNode = { id: 'l', type: 'link', name: '링크', textDecoration: 'none', semanticsReliable: true };
    const f = find(scanNodes([n]).findings, 'link.identifiable')[0];
    expect(f.status).toBe('fail');
  });
  it('밑줄 있는 링크는 pass', () => {
    const n: A11yNode = { id: 'l', type: 'link', name: '링크', textDecoration: 'underline' };
    expect(find(scanNodes([n]).findings, 'link.identifiable')[0].status).toBe('pass');
  });
  it('휴리스틱 소스면 confidence low', () => {
    const n: A11yNode = { id: 'l', type: 'link', textDecoration: 'none', semanticsReliable: false };
    expect(find(scanNodes([n]).findings, 'link.identifiable')[0].confidence).toBe('low');
  });
});

describe('A2 — heading.structure (문서 순서)', () => {
  it('h1 → h3 건너뜀을 fail 로 검출', () => {
    const nodes: A11yNode[] = [
      { id: 'h1', type: 'text', headingLevel: 1 },
      { id: 'h3', type: 'text', headingLevel: 3 },
    ];
    const fs = find(scanNodes(nodes).findings, 'heading.structure');
    expect(fs.find((f) => f.nodeId === 'h3')?.status).toBe('fail');
  });
  it('h1 → h2 → h3 순차는 모두 pass', () => {
    const nodes: A11yNode[] = [
      { id: 'h1', type: 'text', headingLevel: 1 },
      { id: 'h2', type: 'text', headingLevel: 2 },
      { id: 'h3', type: 'text', headingLevel: 3 },
    ];
    const fs = find(scanNodes(nodes).findings, 'heading.structure');
    expect(fs.every((f) => f.status === 'pass')).toBe(true);
  });
  it('첫 제목이 h1 이 아니면 fail', () => {
    const nodes: A11yNode[] = [{ id: 'h2', type: 'text', headingLevel: 2 }];
    expect(find(scanNodes(nodes).findings, 'heading.structure')[0].status).toBe('fail');
  });
  it('제목이 없으면 findings 없음', () => {
    const nodes: A11yNode[] = [{ id: 't', type: 'text', fontSizePx: 16 }];
    expect(find(scanNodes(nodes).findings, 'heading.structure')).toHaveLength(0);
  });
});
