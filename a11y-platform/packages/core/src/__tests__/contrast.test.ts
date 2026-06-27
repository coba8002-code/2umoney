import { describe, it, expect } from 'vitest';
import { contrastRatio, relLuminance, hexToRgb, isLargeText } from '../color/contrast';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
  });
  it('parses 3-digit shorthand', () => {
    expect(hexToRgb('#f80')).toEqual([255, 136, 0]);
  });
  it('ignores alpha (8-digit)', () => {
    expect(hexToRgb('#ff8800cc')).toEqual([255, 136, 0]);
  });
  it('throws on invalid', () => {
    expect(() => hexToRgb('#zzz')).toThrow();
  });
});

describe('relLuminance', () => {
  it('black is 0, white is 1', () => {
    expect(relLuminance('#000000')).toBeCloseTo(0, 6);
    expect(relLuminance('#ffffff')).toBeCloseTo(1, 6);
  });
});

describe('contrastRatio — WCAG 공식 ±0.01 (수용 기준 6.6)', () => {
  // 알려진 검증 케이스
  const cases: [string, string, number][] = [
    ['#000000', '#ffffff', 21.0],
    ['#ffffff', '#ffffff', 1.0],
    ['#767676', '#ffffff', 4.54], // 경계 (AA 통과 직전)
    ['#777777', '#ffffff', 4.48], // 경계 (AA 미달 직전)
    ['#595959', '#ffffff', 7.0], // AAA 근처
    ['#ffffff', '#1976d2', 4.6], // 흔한 파랑 버튼
    ['#d32f2f', '#ffffff', 4.98], // Material red 700
  ];
  it.each(cases)('contrast(%s, %s) ≈ %f', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2);
  });

  it('대칭성: contrast(a,b) === contrast(b,a)', () => {
    expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(
      contrastRatio('#abcdef', '#123456'),
      10,
    );
  });
});

describe('isLargeText (스펙 4.1 px 기준)', () => {
  it('일반 ≥18px 는 큰 글씨', () => {
    expect(isLargeText(18, false, 18, 14)).toBe(true);
    expect(isLargeText(17, false, 18, 14)).toBe(false);
  });
  it('bold ≥14px 는 큰 글씨', () => {
    expect(isLargeText(14, true, 18, 14)).toBe(true);
    expect(isLargeText(13, true, 18, 14)).toBe(false);
  });
});
