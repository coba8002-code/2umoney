import { describe, it, expect } from 'vitest';
import {
  calibrationFromMarker,
  calibrationFromScreenSpec,
  calibrationFromTwoPoints,
  noCalibration,
  hasScale,
  pxToMm,
  areaPxToMm2,
  judgeMbr,
  KNOWN_MARKERS,
} from './calibration';

describe('보정 — 근거별 스케일 산출', () => {
  it('기준 마커(신용카드): 856px 폭 → 0.1 mm/px', () => {
    const cal = calibrationFromMarker({ widthPx: 856, heightPx: 539.8 }, KNOWN_MARKERS.creditCard);
    expect(cal.mmPerPx).toBeCloseTo(0.1, 4);
    expect(cal.confidence).toBe('high');
    expect(pxToMm(cal, 120)).toBeCloseTo(12, 4);
  });

  it('마커 두 축 스케일 차이가 크면 경고+신뢰도 하향', () => {
    const cal = calibrationFromMarker({ widthPx: 856, heightPx: 400 }, KNOWN_MARKERS.creditCard);
    expect(cal.warnings.join()).toMatch(/왜곡|원근/);
    expect(cal.confidence).toBe('medium');
  });

  it('화면 스펙(15.6" 1920x1080) → mm/px ≈ 0.18', () => {
    const cal = calibrationFromScreenSpec({ diagonalInch: 15.6, widthPx: 1920, heightPx: 1080 });
    // diag_mm=396.24, diag_px=2202.9 → 0.1799
    expect(cal.mmPerPx).toBeCloseTo(0.1799, 3);
    expect(cal.confidence).toBe('high');
  });

  it('수동 2점 보정', () => {
    const cal = calibrationFromTwoPoints(200, 50); // 200px = 50mm
    expect(cal.mmPerPx).toBeCloseTo(0.25, 6);
  });

  it('잘못된 입력은 근거 없음(none)', () => {
    expect(hasScale(calibrationFromScreenSpec({ diagonalInch: 0, widthPx: 1920, heightPx: 1080 }))).toBe(false);
    expect(hasScale(noCalibration())).toBe(false);
  });
});

describe('보정 — 면적·MBR 판정', () => {
  it('픽셀 면적 → mm²', () => {
    const cal = calibrationFromTwoPoints(10, 1); // 0.1 mm/px
    expect(areaPxToMm2(cal, 14400)).toBeCloseTo(144, 6); // 120x120 px
  });

  it('MBR: 120x120px @0.1 → 12mm/144mm² 정확히 충족', () => {
    const cal = calibrationFromMarker({ widthPx: 856, heightPx: 539.8 }, KNOWN_MARKERS.creditCard);
    const r = judgeMbr(cal, { widthPx: 120, heightPx: 120 });
    expect(r.pass).toBe(true);
    expect(r.sideMinMm).toBeCloseTo(12, 3);
    expect(r.areaMm2).toBeCloseTo(144, 1);
  });

  it('MBR: 100x100px @0.1 → 10mm 미달로 부적합', () => {
    const cal = calibrationFromTwoPoints(10, 1);
    const r = judgeMbr(cal, { widthPx: 100, heightPx: 100 });
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/미달/);
  });

  it('보정 근거가 없으면 크기 판정 불가(none)', () => {
    const r = judgeMbr(noCalibration(), { widthPx: 200, heightPx: 200 });
    expect(r.confidence).toBe('none');
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/실측|근거/);
  });
});
