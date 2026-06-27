/**
 * WCAG 2.x 색대비 계산. 6.6 수용 기준: WCAG 공식과 ±0.01 이내 일치.
 * 반올림 없이 부동소수 그대로 계산한다.
 */

/** '#rgb' | '#rrggbb' | 'rgb'/'rrggbb' 를 [r,g,b] (0-255) 로 파싱 */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '').toLowerCase();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length === 8) {
    h = h.slice(0, 6); // 알파 무시
  }
  if (h.length !== 6 || /[^0-9a-f]/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const num = parseInt(h, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG 상대 휘도 (relative luminance) */
export function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 명도 대비비 (1 ~ 21) */
export function contrastRatio(fg: string, bg: string): number {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * A1: 반투명 전경색(src, alpha 0~1)을 불투명 배경(dst) 위에 알파 합성(over)한
 * 실효 불투명색을 hex 로 반환. 겹친 반투명 레이어의 유효 배경색 계산에 사용.
 */
export function blendOver(src: string, dst: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const [sr, sg, sb] = hexToRgb(src);
  const [dr, dg, db] = hexToRgb(dst);
  return rgbToHex(sr * a + dr * (1 - a), sg * a + dg * (1 - a), sb * a + db * (1 - a));
}

/**
 * A1: 전경색 fg 에 대해 여러 후보 배경(그라데이션 stop·겹친 레이어) 중
 * **가장 대비가 낮은(최악) 지점**의 대비와 그 배경색을 반환.
 * 텍스트가 배경 전 구간에서 기준을 만족해야 하므로 worst-case 로 판정한다.
 */
export function worstContrast(
  fg: string,
  bgs: string[],
): { ratio: number; bg: string } {
  if (bgs.length === 0) throw new Error('worstContrast: 배경 후보가 비어 있습니다.');
  let worst = { ratio: Infinity, bg: bgs[0] };
  for (const bg of bgs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < worst.ratio) worst = { ratio, bg };
  }
  return worst;
}

/**
 * 텍스트가 "큰 글씨"인지 판정.
 * WCAG: ≥18pt(=24px) 또는 ≥14pt bold(=18.66px). 단, KWCAG/스펙(4.1)은
 * px 기준 ≥18px(일반) / ≥14px(bold) 를 사용하므로 스펙 파라미터를 따른다.
 */
export function isLargeText(
  fontSizePx: number | undefined,
  bold: boolean | undefined,
  largePx: number,
  largeBoldPx: number,
): boolean {
  if (fontSizePx == null) return false;
  if (bold) return fontSizePx >= largeBoldPx;
  return fontSizePx >= largePx;
}
