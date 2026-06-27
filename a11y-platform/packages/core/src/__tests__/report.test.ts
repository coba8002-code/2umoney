import { describe, it, expect } from 'vitest';
import { scanNodes } from '../engine';
import { buildReport, reportToJson, reportToText } from '../report';
import type { A11yNode } from '../types';

const nodes: A11yNode[] = [
  { id: 'ok', type: 'text', fgColor: '#000', bgColor: '#fff', fontSizePx: 16 },
  { id: 'bad', type: 'text', fgColor: '#ccc', bgColor: '#fff', fontSizePx: 16 },
  { id: 'img', type: 'image', name: '사진' },
];

describe('buildReport — 가드레일 5장 준수', () => {
  it('출처별(auto/ai-assisted/manual) 집계를 분리한다', () => {
    const r = buildReport(scanNodes(nodes));
    expect(r.breakdown.auto + r.breakdown.aiAssisted + r.breakdown.manual).toBe(r.findings.length);
    expect(r.breakdown.aiAssisted).toBeGreaterThanOrEqual(1); // img.alt 누락 = ai-assisted
  });

  it('단정 표현 없이 자동판정 기준임을 명시한다', () => {
    const r = buildReport(scanNodes(nodes));
    expect(r.generatedNote).toContain('보장하지 않습니다');
    expect(r.generatedNote).not.toMatch(/100%|완벽|보장합니다/);
  });

  it('JSON/텍스트 직렬화가 동작한다', () => {
    const result = scanNodes(nodes);
    expect(() => JSON.parse(reportToJson(result))).not.toThrow();
    expect(reportToText(result)).toContain('예상 통과율');
  });
});
