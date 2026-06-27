import { describe, it, expect } from 'vitest';
import { nearestPassingColor } from '../color/nearestPassingColor';
import { contrastRatio } from '../color/contrast';
import { converter, parse } from 'culori';

const toOklch = converter('oklch');

describe('nearestPassingColor — 스타일 유지 색 보정 (4.3)', () => {
  it('이미 통과 색은 그대로 둔다', () => {
    const r = nearestPassingColor('#000000', '#ffffff', 4.5);
    expect(r.passed).toBe(true);
    expect(r.adjusted).toBe('none');
  });

  it('미달 색을 보정 후 반드시 재검증 통과 (수용 기준 6.6)', () => {
    const fails: [string, string, number][] = [
      ['#999999', '#ffffff', 4.5],
      ['#1976d2', '#1565c0', 4.5], // 파랑 위 파랑
      ['#777777', '#ffffff', 4.5],
      ['#aaaaaa', '#cccccc', 3.0],
      ['#ffeb3b', '#ffffff', 4.5], // 노랑 위 흰색 (어렵게 어둡게 가야 함)
      ['#888888', '#999999', 4.5],
    ];
    for (const [fg, bg, target] of fails) {
      const r = nearestPassingColor(fg, bg, target);
      // 결과 hex 로 직접 재검증
      expect(contrastRatio(r.color, bg)).toBeGreaterThanOrEqual(target - 0.001);
      expect(r.passed).toBe(true);
    }
  });

  it('색상(Hue)을 보존한다 (브랜드 톤 유지)', () => {
    const fg = '#1976d2'; // 파랑
    const bg = '#90caf9'; // 옅은 파랑
    const r = nearestPassingColor(fg, bg, 4.5);
    const h0 = toOklch(parse(fg)!).h ?? 0;
    const h1 = toOklch(parse(r.color)!).h ?? 0;
    // 명도만 조정 → 색상 유지 (gamut clamp 로 약간의 오차 허용)
    const dh = Math.min(Math.abs(h1 - h0), 360 - Math.abs(h1 - h0));
    expect(dh).toBeLessThan(8);
    expect(r.adjusted).toBe('lightness');
  });

  it('큰 글씨 기준(3:1)은 더 적은 변경으로 통과', () => {
    const r3 = nearestPassingColor('#999999', '#ffffff', 3.0);
    const r45 = nearestPassingColor('#999999', '#ffffff', 4.5);
    expect(contrastRatio(r3.color, '#ffffff')).toBeGreaterThanOrEqual(3.0 - 0.001);
    expect(contrastRatio(r45.color, '#ffffff')).toBeGreaterThanOrEqual(4.5 - 0.001);
  });

  it('극단(target=21)은 흑/백으로 수렴', () => {
    const r = nearestPassingColor('#808080', '#ffffff', 21);
    // 21 은 흑 외 불가 → 거의 검정, passed=true
    expect(contrastRatio(r.color, '#ffffff')).toBeGreaterThanOrEqual(21 - 0.05);
    expect(r.passed).toBe(true);
  });
});
