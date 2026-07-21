/**
 * P3: 공구 형상 — 공구 축에서 반경거리 d 에 따른 "공구 바닥면의 Z 오프셋".
 * 공구 팁(tip)이 z=zt 일 때, 반경 d 지점의 공구 하단은 zt + offset(d).
 */
export type CutterType = 'flat' | 'ball';

export interface Cutter {
  type: CutterType;
  radiusMm: number;
}

export const flatEndmill = (diameterMm: number): Cutter => ({ type: 'flat', radiusMm: diameterMm / 2 });
export const ballEndmill = (diameterMm: number): Cutter => ({ type: 'ball', radiusMm: diameterMm / 2 });

/**
 * 반경거리 d(mm)에서 공구 하단의 Z 오프셋. 접촉하지 않으면 Infinity.
 * - flat: 반경 안(d<=r)이면 0(평평한 바닥), 밖이면 접촉 없음
 * - ball: 반경 안이면 r - sqrt(r^2 - d^2) (구면), 밖이면 접촉 없음
 */
export function bottomOffset(cutter: Cutter, d: number): number {
  const r = cutter.radiusMm;
  if (d > r + 1e-9) return Infinity;
  const dd = Math.min(d, r);
  if (cutter.type === 'flat') return 0;
  return r - Math.sqrt(Math.max(0, r * r - dd * dd));
}
