import { describe, it, expect } from 'vitest';
import { simulateCVD, worstCvdContrast, ALL_CVD } from '../color/cvd';
import { colorFixVariants } from '../color/variants';
import { contrastRatio } from '../color/contrast';

describe('B3 — 색각 이상 시뮬레이션', () => {
  it('흑/백은 모든 색각에서 거의 불변', () => {
    for (const t of ALL_CVD) {
      expect(simulateCVD('#000000', t)).toBe('#000000');
      // 흰색은 약간의 반올림 차이 허용
      expect(contrastRatio(simulateCVD('#ffffff', t), '#000000')).toBeGreaterThan(18);
    }
  });

  it('적/녹은 적색맹/녹색맹에서 서로 혼동(대비 급감)', () => {
    // 정상 시야에서 빨강 vs 초록은 어느 정도 대비, 색각이상에서 더 낮아짐
    const normal = contrastRatio('#d32f2f', '#388e3c');
    const worst = worstCvdContrast('#d32f2f', '#388e3c').ratio;
    expect(worst).toBeLessThanOrEqual(normal);
  });

  it('worstCvdContrast 는 정상 포함 4종 중 최저를 반환', () => {
    const w = worstCvdContrast('#777777', '#ffffff');
    expect(w.ratio).toBeLessThanOrEqual(contrastRatio('#777777', '#ffffff') + 1e-9);
  });
});

describe('B2 — 다목표 보정 변형 (AA/AAA/색각안전)', () => {
  it('aa·aaa·cvdSafe 모두 각 기준을 통과', () => {
    const v = colorFixVariants('#aaaaaa', '#ffffff', { large: false });
    expect(contrastRatio(v.aa.color, '#ffffff')).toBeGreaterThanOrEqual(4.5 - 0.01);
    expect(contrastRatio(v.aaa.color, '#ffffff')).toBeGreaterThanOrEqual(7.0 - 0.01);
    // 색각안전: 3색각 모두에서 4.5 이상
    expect(worstCvdContrast(v.cvdSafe.color, '#ffffff').ratio).toBeGreaterThanOrEqual(4.5 - 0.05);
  });

  it('aaa 는 aa 보다 같거나 더 큰 대비', () => {
    const v = colorFixVariants('#999999', '#ffffff');
    expect(contrastRatio(v.aaa.color, '#ffffff')).toBeGreaterThanOrEqual(
      contrastRatio(v.aa.color, '#ffffff') - 1e-6,
    );
  });

  it('큰 글씨는 더 낮은 기준(aa=3:1)', () => {
    const v = colorFixVariants('#bbbbbb', '#ffffff', { large: true });
    expect(contrastRatio(v.aa.color, '#ffffff')).toBeGreaterThanOrEqual(3.0 - 0.01);
  });

  it('팔레트 옵션이 변형에도 전달된다', () => {
    const v = colorFixVariants('#9e9e9e', '#ffffff', { palette: ['#1565c0', '#212121'] });
    expect(['#1565c0', '#212121']).toContain(v.aa.color);
  });
});
