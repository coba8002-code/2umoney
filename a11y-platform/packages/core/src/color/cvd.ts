/**
 * B3: 색각 이상(Color Vision Deficiency) 시뮬레이션.
 * Viénot–Brettel–Mollon(1999) 단일 행렬 근사. 선형 sRGB 공간에서 변환한다.
 */
import { hexToRgb, rgbToHex, contrastRatio } from './contrast';

export type CvdType = 'protanopia' | 'deuteranopia' | 'tritanopia';

// 선형 RGB 기준 시뮬레이션 행렬 (행 우선 3x3)
const MATRICES: Record<CvdType, number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const toSrgb = (l: number): number => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
};

/** hex 색을 특정 색각 이상으로 본 색(hex)으로 시뮬레이션 */
export function simulateCVD(hex: string, type: CvdType): string {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const m = MATRICES[type];
  const lr = m[0] * r + m[1] * g + m[2] * b;
  const lg = m[3] * r + m[4] * g + m[5] * b;
  const lb = m[6] * r + m[7] * g + m[8] * b;
  return rgbToHex(toSrgb(lr), toSrgb(lg), toSrgb(lb));
}

export const ALL_CVD: CvdType[] = ['protanopia', 'deuteranopia', 'tritanopia'];

/**
 * 정상 시야 + 3가지 색각 이상 각각에서의 fg/bg 대비 중 최악값.
 * 색각 이상에서도 충분한 대비가 유지되는지 평가한다.
 */
export function worstCvdContrast(fg: string, bg: string): { ratio: number; type: CvdType | 'normal' } {
  let worst: { ratio: number; type: CvdType | 'normal' } = { ratio: contrastRatio(fg, bg), type: 'normal' };
  for (const t of ALL_CVD) {
    const ratio = contrastRatio(simulateCVD(fg, t), simulateCVD(bg, t));
    if (ratio < worst.ratio) worst = { ratio, type: t };
  }
  return worst;
}
