import { converter, formatHex, parse, differenceEuclidean } from 'culori';
import { contrastRatio } from './contrast';

const toOklch = converter('oklch');
const deltaEOk = differenceEuclidean('oklab');

export interface NearestColorResult {
  /** 보정된 hex (이미 통과 시 입력 정규화값) */
  color: string;
  /** 보정 후 실측 대비비 (gamut clamp 반영) */
  ratio: number;
  passed: boolean;
  /** 어떤 채널/방식으로 조정했는지 */
  adjusted: 'none' | 'lightness' | 'lightness+chroma' | 'palette';
  styleImpact: 'none' | 'minimal' | 'visible';
  /** B1: 팔레트 색을 채택한 경우 그 hex */
  paletteColor?: string;
}

export interface NearestColorOptions {
  /** B1: 우선 채택할 디자인 시스템 팔레트(hex). 통과하는 색이 있으면 최소 색차(ΔE)로 선택. */
  palette?: string[];
}

/** 팔레트 중 통과하는 색을 원본과 가장 가까운(ΔE 최소) 순으로 선택 */
function pickFromPalette(fg: string, bg: string, target: number, palette: string[]): string | null {
  const fgColor = parse(fg);
  let best: { hex: string; de: number } | null = null;
  for (const cand of palette) {
    const parsed = parse(cand);
    if (!parsed) continue;
    const hex = formatHex(parsed)!;
    if (contrastRatio(hex, bg) < target - 1e-9) continue; // 미통과 제외
    const de = fgColor ? deltaEOk(fgColor, parsed) : 0;
    if (!best || de < best.de) best = { hex, de };
  }
  return best ? best.hex : null;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function normalizeHex(hex: string): string {
  const parsed = parse(hex);
  if (!parsed) throw new Error(`Invalid color: ${hex}`);
  return formatHex(parsed)!;
}

/**
 * `from`(미달) 에서 `to`(통과 가정) 방향으로 L 을 이분 탐색해
 * 목표 대비를 만족하는 `from` 에 가장 가까운 L 을 찾는다.
 * 통과 색을 못 만들면 null.
 */
function searchDirection(
  from: number,
  to: number,
  target: number,
  ratioAtL: (L: number) => number,
): { L: number; ratio: number } | null {
  if (ratioAtL(to) < target) return null; // 이 방향 극단도 미달 → 불가
  let lo = from; // 미달측
  let hi = to; // 통과측
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ratioAtL(mid) >= target) hi = mid;
    else lo = mid;
  }
  return { L: hi, ratio: ratioAtL(hi) };
}

/**
 * 스타일 유지 색 보정 (4.3): 색상(H)·채도(C) 고정, 명도(L)만 조정해
 * 목표 대비를 만족하는 최소 변경 색을 반환. 항상 결과 hex 로 재검증한다.
 *
 * 1) 이미 통과면 그대로 반환
 * 2) L 을 어둡게/밝게 양방향 이분 탐색 → 변경량 작은 쪽 채택
 * 3) 양방향 모두 불가하면 C(채도)=0 로 낮춰 재시도 (fallback)
 * 4) 그래도 불가하면 흑/백 중 대비 큰 쪽 반환 (passed=false 가능)
 */
export function nearestPassingColor(
  fg: string,
  bg: string,
  target = 4.5,
  opts: NearestColorOptions = {},
): NearestColorResult {
  const startRatio = contrastRatio(fg, bg);
  if (startRatio >= target) {
    return {
      color: normalizeHex(fg),
      ratio: startRatio,
      passed: true,
      adjusted: 'none',
      styleImpact: 'none',
    };
  }

  // B1: 팔레트에 통과 색이 있으면 토큰 일관성을 위해 우선 채택
  if (opts.palette && opts.palette.length > 0) {
    const fromPalette = pickFromPalette(fg, bg, target, opts.palette);
    if (fromPalette) {
      const ratio = contrastRatio(fromPalette, bg);
      const lDelta = Math.abs((toOklch(parse(fromPalette)!).l ?? 0) - (toOklch(parse(fg)!).l ?? 0));
      return {
        color: fromPalette,
        ratio,
        passed: true,
        adjusted: 'palette',
        styleImpact: lDelta > 0.25 ? 'visible' : 'minimal',
        paletteColor: fromPalette,
      };
    }
  }

  const base = toOklch(parse(fg)!);
  const L0 = base.l ?? 0;
  const C0 = base.c ?? 0;
  const H0 = base.h ?? 0;

  const hexAtL = (L: number, c: number): string =>
    formatHex({ mode: 'oklch', l: clamp01(L), c, h: H0 }) ?? '#000000';
  const makeRatioFn =
    (c: number) =>
    (L: number): number =>
      contrastRatio(hexAtL(L, c), bg);

  // 1차: 채도 유지하고 L 만 조정
  let ratioAtL = makeRatioFn(C0);
  const darker = searchDirection(L0, 0, target, ratioAtL);
  const lighter = searchDirection(L0, 1, target, ratioAtL);

  const pick = (
    cands: ({ L: number; ratio: number } | null)[],
  ): { L: number; ratio: number } | null => {
    const valid = cands.filter((c): c is { L: number; ratio: number } => c != null);
    if (valid.length === 0) return null;
    // L0 에서 가장 적게 움직인 후보
    return valid.reduce((a, b) => (Math.abs(a.L - L0) <= Math.abs(b.L - L0) ? a : b));
  };

  let best = pick([darker, lighter]);
  let usedChroma = C0;
  let adjusted: NearestColorResult['adjusted'] = 'lightness';

  // fallback: 채도까지 낮춰서 재시도
  if (!best) {
    usedChroma = 0;
    ratioAtL = makeRatioFn(0);
    const d2 = searchDirection(L0, 0, target, ratioAtL);
    const l2 = searchDirection(L0, 1, target, ratioAtL);
    best = pick([d2, l2]);
    adjusted = 'lightness+chroma';
  }

  if (best) {
    const color = hexAtL(best.L, usedChroma);
    const finalRatio = contrastRatio(color, bg); // 자기검증 루프
    const lDelta = Math.abs(best.L - L0);
    return {
      color,
      ratio: finalRatio,
      passed: finalRatio >= target - 1e-9,
      adjusted,
      styleImpact: adjusted === 'lightness+chroma' || lDelta > 0.25 ? 'visible' : 'minimal',
    };
  }

  // 최후: 흑/백 중 대비가 큰 쪽 (target 도달 불가 — 매우 높은 target)
  const black = contrastRatio('#000000', bg);
  const white = contrastRatio('#ffffff', bg);
  const color = black >= white ? '#000000' : '#ffffff';
  const finalRatio = Math.max(black, white);
  return {
    color,
    ratio: finalRatio,
    passed: finalRatio >= target - 1e-9,
    adjusted: 'lightness+chroma',
    styleImpact: 'visible',
  };
}
