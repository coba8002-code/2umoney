/**
 * P2: Unity 트윈 뷰 계약 — ToolpathResult 를 Unity(JsonUtility)가 바로 역직렬화할 수 있는
 * 평탄한 구조로 변환한다. 필드명은 C# [Serializable] 클래스와 1:1 로 일치시킨다.
 * (JsonUtility 제약: Dictionary 불가, 최상위 객체·중첩 배열/객체만. 여기서 준수)
 */
import type { ToolpathResult, ToolpathPoint } from '../toolpath/generator';

export interface UVec3 {
  x: number;
  y: number;
  z: number;
}
export interface UPoint {
  x: number;
  y: number;
  z: number;
  kind: string; // 'rapid' | 'feed'
  feedMmMin: number;
  tSec: number;
}
export interface UnityToolpathDoc {
  units: 'mm';
  cycleTimeSec: number;
  pointCount: number;
  bounds: { min: UVec3; max: UVec3 };
  points: UPoint[];
}

const round = (n: number, p = 4): number => {
  const f = 10 ** p;
  return Math.round(n * f) / f;
};

const toU = (p: ToolpathPoint): UPoint => ({
  x: round(p.x),
  y: round(p.y),
  z: round(p.z),
  kind: p.kind,
  feedMmMin: round(p.feedMmMin, 2),
  tSec: round(p.tSec, 4),
});

export function toUnityToolpath(result: ToolpathResult): UnityToolpathDoc {
  return {
    units: 'mm',
    cycleTimeSec: round(result.cycleTimeSec, 4),
    pointCount: result.points.length,
    bounds: {
      min: { x: round(result.bounds.min.x), y: round(result.bounds.min.y), z: round(result.bounds.min.z) },
      max: { x: round(result.bounds.max.x), y: round(result.bounds.max.y), z: round(result.bounds.max.z) },
    },
    points: result.points.map(toU),
  };
}

export function toUnityToolpathJson(result: ToolpathResult): string {
  return JSON.stringify(toUnityToolpath(result), null, 2);
}
