import { describe, it, expect } from 'vitest';
import { scanNodes } from '../engine';
import { contrastRatio } from '../color/contrast';
import type { A11yNode, Finding } from '../types';

const find = (fs: Finding[], ruleId: string) => fs.filter((f) => f.ruleId === ruleId);

describe('scanNodes — 통합 진단', () => {
  it('대비 미달 텍스트를 검출하고 보정 제안을 재검증한다 (6.6)', () => {
    const node: A11yNode = {
      id: 't1',
      type: 'text',
      name: '본문',
      fgColor: '#999999',
      bgColor: '#ffffff',
      fontSizePx: 14,
    };
    const { findings } = scanNodes([node]);
    const f = find(findings, 'contrast.text')[0];
    expect(f.status).toBe('fail');
    expect(f.source).toBe('auto');
    expect(f.fix?.kind).toBe('color');
    // 보정 제안값이 실제로 기준을 통과하는지
    const after = f.fix!.after.fgColor as string;
    expect(contrastRatio(after, '#ffffff')).toBeGreaterThanOrEqual(4.5 - 0.001);
  });

  it('44px 미만 버튼을 검출하고 크기 보정을 제안한다', () => {
    const node: A11yNode = {
      id: 'b1',
      type: 'button',
      name: '확인',
      label: '확인',
      width: 30,
      height: 28,
    };
    const f = find(scanNodes([node]).findings, 'target.size')[0];
    expect(f.status).toBe('fail');
    expect(f.fix?.after).toEqual({ width: 44, height: 44 });
  });

  it('alt 없는 이미지를 critical 로 검출 (장식은 통과)', () => {
    const img: A11yNode = { id: 'i1', type: 'image', name: '로고' };
    const deco: A11yNode = { id: 'i2', type: 'image', decorative: true };
    const fs = scanNodes([img, deco]).findings;
    const f1 = find(fs, 'img.alt').find((f) => f.nodeId === 'i1')!;
    const f2 = find(fs, 'img.alt').find((f) => f.nodeId === 'i2')!;
    expect(f1.status).toBe('fail');
    expect(f1.severity).toBe('critical');
    expect(f1.source).toBe('ai-assisted');
    expect(f2.status).toBe('pass');
  });

  it('레이블 없는 컨트롤을 검출한다', () => {
    const input: A11yNode = { id: 'in1', type: 'input', width: 200, height: 48 };
    const f = find(scanNodes([input]).findings, 'control.label')[0];
    expect(f.status).toBe('fail');
  });

  it('포커스 스타일 없는 포커스 가능 요소를 검출한다', () => {
    const node: A11yNode = {
      id: 'l1',
      type: 'link',
      name: '바로가기',
      focusable: true,
      hasVisibleFocusStyle: false,
      fgColor: '#1976d2',
      bgColor: '#ffffff',
    };
    const f = find(scanNodes([node]).findings, 'focus.visible')[0];
    expect(f.status).toBe('fail');
    expect(f.fix?.kind).toBe('focusStyle');
  });

  it('summary 는 자동판정 기준 통과율과 라벨을 제공한다 (가드레일 5장)', () => {
    const nodes: A11yNode[] = [
      { id: 'ok', type: 'text', fgColor: '#000', bgColor: '#fff', fontSizePx: 16 },
      { id: 'bad', type: 'text', fgColor: '#ccc', bgColor: '#fff', fontSizePx: 16 },
    ];
    const { summary } = scanNodes(nodes);
    expect(summary.pass).toBeGreaterThanOrEqual(1);
    expect(summary.fail).toBeGreaterThanOrEqual(1);
    expect(summary.estimatedPassRate).toBeGreaterThan(0);
    expect(summary.estimatedPassRate).toBeLessThanOrEqual(1);
    expect(summary.estimatedPassRateLabel).toContain('자동판정');
  });

  it('자식 노드까지 재귀 스캔한다', () => {
    const tree: A11yNode = {
      id: 'root',
      type: 'container',
      children: [{ id: 'child', type: 'button', width: 10, height: 10, label: 'x' }],
    };
    const f = find(scanNodes([tree]).findings, 'target.size');
    expect(f.length).toBe(1);
    expect(f[0].nodeId).toBe('child');
  });
});
