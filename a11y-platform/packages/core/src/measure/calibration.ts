/**
 * px→mm 실측 보정 — 이미지 픽셀을 실제 mm 로 환산한다.
 * 키오스크 기준(버튼 12mm/144mm², 간격 2.5mm, 문자 7.25mm)은 물리 치수라
 * 스케일 근거 없이는 판정할 수 없다. 근거는 3가지 중 하나:
 *   1) 기준 마커(신용카드·A4 등 알려진 실물 크기)
 *   2) 화면 스펙(대각 인치 + 해상도) — 단말 스크린샷일 때
 *   3) 수동 2점(알려진 실측 거리)
 * 근거가 없으면 confidence='none' → 크기 판정은 "추정 불가, 실측 필요"로만 처리.
 */

export type CalibrationSource = 'marker' | 'screen-spec' | 'manual' | 'design' | 'none';
export type CalibConfidence = 'high' | 'medium' | 'low' | 'none';

export interface Calibration {
  /** 1픽셀당 실제 mm */
  mmPerPx: number;
  source: CalibrationSource;
  confidence: CalibConfidence;
  warnings: string[];
}

/** 널 보정(근거 없음) — 크기 판정 불가 표식 */
export function noCalibration(): Calibration {
  return { mmPerPx: NaN, source: 'none', confidence: 'none', warnings: ['스케일 근거 없음 — 크기 판정 불가(실측 필요)'] };
}

export const KNOWN_MARKERS = {
  creditCard: { widthMm: 85.6, heightMm: 53.98 },
  a4: { widthMm: 210, heightMm: 297 },
} as const;

/** 기준 마커의 픽셀 크기 + 실물 크기 → 보정. 두 축 스케일 차이가 크면 경고(원근/왜곡). */
export function calibrationFromMarker(
  markerPx: { widthPx: number; heightPx: number },
  markerMm: { widthMm: number; heightMm: number },
): Calibration {
  const warnings: string[] = [];
  if (markerPx.widthPx <= 0 || markerPx.heightPx <= 0) {
    return { ...noCalibration(), warnings: ['마커 픽셀 크기가 올바르지 않습니다.'] };
  }
  const sx = markerMm.widthMm / markerPx.widthPx;
  const sy = markerMm.heightMm / markerPx.heightPx;
  const skew = Math.abs(sx - sy) / ((sx + sy) / 2);
  let confidence: CalibConfidence = 'high';
  if (skew > 0.15) {
    warnings.push(`마커 두 축 스케일 차이 ${(skew * 100).toFixed(0)}% — 원근/왜곡 가능. 정면 촬영 권장.`);
    confidence = 'medium';
  }
  return { mmPerPx: (sx + sy) / 2, source: 'marker', confidence, warnings };
}

/** 화면 대각 인치 + 픽셀 해상도 → 보정(단말 스크린샷 등 화면 좌표계일 때). */
export function calibrationFromScreenSpec(spec: {
  diagonalInch: number;
  widthPx: number;
  heightPx: number;
}): Calibration {
  if (spec.diagonalInch <= 0 || spec.widthPx <= 0 || spec.heightPx <= 0) {
    return { ...noCalibration(), warnings: ['화면 스펙 값이 올바르지 않습니다.'] };
  }
  const diagMm = spec.diagonalInch * 25.4;
  const diagPx = Math.hypot(spec.widthPx, spec.heightPx);
  return { mmPerPx: diagMm / diagPx, source: 'screen-spec', confidence: 'high', warnings: [] };
}

/** 수동 2점: 픽셀 거리와 실제 mm 거리. */
export function calibrationFromTwoPoints(pxDistance: number, realMm: number): Calibration {
  if (pxDistance <= 0 || realMm <= 0) return { ...noCalibration(), warnings: ['2점 보정 값이 올바르지 않습니다.'] };
  return { mmPerPx: realMm / pxDistance, source: 'manual', confidence: 'medium', warnings: [] };
}

export function hasScale(cal: Calibration): boolean {
  return cal.source !== 'none' && Number.isFinite(cal.mmPerPx) && cal.mmPerPx > 0;
}

export function pxToMm(cal: Calibration, px: number): number {
  return px * cal.mmPerPx;
}

/** 픽셀 면적 → mm² */
export function areaPxToMm2(cal: Calibration, areaPx: number): number {
  return areaPx * cal.mmPerPx * cal.mmPerPx;
}

export interface MbrThresholds {
  minSideMm: number; // 별표5 1.c: 12
  minAreaMm2: number; // 별표5 1.c: 144
}

export interface MbrResult {
  sideMinMm: number;
  areaMm2: number;
  pass: boolean;
  confidence: CalibConfidence;
  reason: string;
}

/** 버튼 경계상자(px) → MBR 기준(각 변 12mm·면적 144mm²) 판정. 보정 없으면 판정 불가. */
export function judgeMbr(
  cal: Calibration,
  boxPx: { widthPx: number; heightPx: number },
  thr: MbrThresholds = { minSideMm: 12, minAreaMm2: 144 },
): MbrResult {
  if (!hasScale(cal)) {
    return {
      sideMinMm: NaN,
      areaMm2: NaN,
      pass: false,
      confidence: 'none',
      reason: '스케일 근거가 없어 크기를 판정할 수 없습니다. 기준 마커/화면 스펙/설계 치수를 입력하세요.',
    };
  }
  const wMm = pxToMm(cal, boxPx.widthPx);
  const hMm = pxToMm(cal, boxPx.heightPx);
  const sideMin = Math.min(wMm, hMm);
  const areaMm2 = wMm * hMm;
  const pass = sideMin >= thr.minSideMm - 1e-6 && areaMm2 >= thr.minAreaMm2 - 1e-6;
  return {
    sideMinMm: sideMin,
    areaMm2,
    pass,
    confidence: cal.confidence,
    reason: pass
      ? `MBR 충족 (최소변 ${sideMin.toFixed(1)}mm, 면적 ${areaMm2.toFixed(0)}mm²)`
      : `MBR 미달 (최소변 ${sideMin.toFixed(1)}mm/기준 ${thr.minSideMm}, 면적 ${areaMm2.toFixed(0)}mm²/기준 ${thr.minAreaMm2})`,
  };
}
