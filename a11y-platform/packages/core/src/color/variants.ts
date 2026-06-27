/**
 * B2: 다목표 색 보정 변형. 같은 미달 색에 대해
 *  - aa: 최소 변경(현행 기준 통과)
 *  - aaa: 7:1(대형 4.5:1) 강화 기준
 *  - cvdSafe: 색각 이상에서도 대비 유지
 * 세 가지 후보를 제공해 사용자가 미리보기 후 선택하게 한다.
 */
import { nearestPassingColor, type NearestColorResult, type NearestColorOptions } from './nearestPassingColor';
import { worstCvdContrast } from './cvd';

export interface ColorFixVariants {
  aa: NearestColorResult;
  aaa: NearestColorResult;
  /** 색각 이상(3종) 모두에서 aa 기준을 만족하는 색 */
  cvdSafe: NearestColorResult;
}

export interface VariantOptions extends NearestColorOptions {
  /** 큰 글씨 여부 (기준값 결정) */
  large?: boolean;
}

/** aa/aaa 목표값 (일반 vs 큰 글씨) */
function targets(large: boolean): { aa: number; aaa: number } {
  return large ? { aa: 3.0, aaa: 4.5 } : { aa: 4.5, aaa: 7.0 };
}

/**
 * 색각 안전 색: 정상 + 3색각 이상 모두에서 aa 기준을 만족할 때까지
 * 명도 목표를 점진 상향하며 nearestPassingColor 로 탐색.
 */
function cvdSafeColor(fg: string, bg: string, aa: number, opts: NearestColorOptions): NearestColorResult {
  for (let bump = 0; bump <= 6; bump++) {
    const target = aa + bump; // 점점 강한 대비를 요구해 색각 여유 확보
    const r = nearestPassingColor(fg, bg, target, opts);
    if (!r.passed) break;
    if (worstCvdContrast(r.color, bg).ratio >= aa - 1e-6) return r;
  }
  // 폴백: 최대 대비(흑/백 포함) 보정
  return nearestPassingColor(fg, bg, 21, opts);
}

export function colorFixVariants(
  fg: string,
  bg: string,
  opts: VariantOptions = {},
): ColorFixVariants {
  const { aa, aaa } = targets(opts.large ?? false);
  const baseOpts: NearestColorOptions = { palette: opts.palette };
  return {
    aa: nearestPassingColor(fg, bg, aa, baseOpts),
    aaa: nearestPassingColor(fg, bg, aaa, baseOpts),
    cvdSafe: cvdSafeColor(fg, bg, aa, baseOpts),
  };
}
