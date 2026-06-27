import { describe, it, expect } from 'vitest';
import { blendOver, worstContrast, contrastRatio } from '../color/contrast';
import { nearestPassingColor } from '../color/nearestPassingColor';
import { scanNodes } from '../engine';
import type { A11yNode, Finding } from '../types';

const find = (fs: Finding[], ruleId: string) => fs.filter((f) => f.ruleId === ruleId);

describe('A1 — 알파 블렌딩 / 최악지점 대비', () => {
  it('blendOver: alpha=1 은 원본, alpha=0 은 배경', () => {
    expect(blendOver('#ff0000', '#ffffff', 1)).toBe('#ff0000');
    expect(blendOver('#ff0000', '#ffffff', 0)).toBe('#ffffff');
  });
  it('blendOver: 50% 검정 위 흰색 = 회색', () => {
    expect(blendOver('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('worstContrast: 그라데이션 stop 중 최저 대비 지점을 고른다', () => {
    // 흰 글씨가 밝은 stop(#cccccc)에서 가장 대비가 낮음
    const w = worstContrast('#ffffff', ['#000000', '#777777', '#cccccc']);
    expect(w.bg).toBe('#cccccc');
    expect(w.ratio).toBeCloseTo(contrastRatio('#ffffff', '#cccccc'), 6);
  });

  it('scan: bgColors(그라데이션)는 최악지점으로 fail 판정', () => {
    const node: A11yNode = {
      id: 't',
      type: 'text',
      name: '그라데이션 위 텍스트',
      fgColor: '#ffffff',
      bgColors: ['#1565c0', '#90caf9'], // 진파랑→옅은파랑; 옅은쪽에서 미달
      fontSizePx: 16,
    };
    const f = find(scanNodes([node]).findings, 'contrast.text')[0];
    expect(f.status).toBe('fail');
    expect(f.evidence?.multiBg).toBe(true);
    // 보정 색은 최악(옅은) 배경에서도 통과해야 함
    const after = f.fix!.after.fgColor as string;
    expect(contrastRatio(after, '#90caf9')).toBeGreaterThanOrEqual(4.5 - 0.001);
  });
});

describe('B1 — 팔레트/토큰 인지 보정', () => {
  it('팔레트에 통과 색이 있으면 그 색을 채택(adjusted=palette)', () => {
    const r = nearestPassingColor('#9e9e9e', '#ffffff', 4.5, {
      palette: ['#e0e0e0', '#1976d2', '#0d47a1', '#212121'],
    });
    expect(r.adjusted).toBe('palette');
    expect(r.passed).toBe(true);
    expect(['#1976d2', '#0d47a1', '#212121']).toContain(r.color);
    expect(contrastRatio(r.color, '#ffffff')).toBeGreaterThanOrEqual(4.5 - 0.001);
  });

  it('팔레트에 통과 색이 없으면 연속 탐색으로 폴백', () => {
    const r = nearestPassingColor('#9e9e9e', '#ffffff', 4.5, {
      palette: ['#fafafa', '#eeeeee'], // 둘 다 미통과
    });
    expect(r.adjusted).not.toBe('palette');
    expect(r.passed).toBe(true);
  });

  it('팔레트는 원본과 색차(ΔE) 가장 가까운 통과색을 고른다', () => {
    // 회색 원본(#888)에 가장 가까운 통과색은 경계 회색 #767676 (명도 최근접)
    const r = nearestPassingColor('#888888', '#ffffff', 4.5, {
      palette: ['#767676', '#595959', '#212121'], // 모두 통과, 명도만 다름
    });
    expect(r.color).toBe('#767676');
  });

  it('scan 옵션 palette 가 contrast 룰까지 전달된다', () => {
    const node: A11yNode = { id: 'p', type: 'text', name: '본문', fgColor: '#9e9e9e', bgColor: '#ffffff', fontSizePx: 16 };
    const { findings } = scanNodes([node], { palette: ['#1976d2', '#212121'] });
    const f = find(findings, 'contrast.text')[0];
    expect(['#1976d2', '#212121']).toContain(f.fix!.after.fgColor);
  });
});

describe('A3 — 신뢰도(confidence)', () => {
  it('휴리스틱 의미정보(semanticsReliable=false)는 low', () => {
    const node: A11yNode = { id: 'i', type: 'image', name: '이미지', semanticsReliable: false };
    const f = find(scanNodes([node]).findings, 'img.alt')[0];
    expect(f.status).toBe('fail');
    expect(f.confidence).toBe('low');
    expect(f.confidenceReason).toBeTruthy();
  });

  it('신뢰 가능한 소스는 high (기본값)', () => {
    const node: A11yNode = { id: 'i', type: 'image', name: '이미지', semanticsReliable: true };
    const f = find(scanNodes([node]).findings, 'img.alt')[0];
    expect(f.confidence).toBe('high');
  });

  it('측정 기반 룰(대비)은 항상 high', () => {
    const node: A11yNode = { id: 't', type: 'text', fgColor: '#999', bgColor: '#fff', fontSizePx: 16, semanticsReliable: false };
    const f = find(scanNodes([node]).findings, 'contrast.text')[0];
    expect(f.confidence).toBe('high');
  });
});
