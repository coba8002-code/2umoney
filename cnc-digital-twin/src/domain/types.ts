/**
 * 도메인 모델 — 엔진(Unity) 독립. 모든 길이 단위는 내부적으로 mm 로 정규화한다.
 * 범용 축(Axis) 구성으로 3축/5축/선반을 데이터로 표현할 수 있게 설계한다.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function addVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function scaleVec(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export type AxisKind = 'linear' | 'rotary';

/** 한 축의 정의. linear 는 unit 방향으로 mm 이동, rotary 는 unit 축 둘레 회전(도). */
export interface AxisConfig {
  name: string; // 'X','Y','Z','A','B','C'
  kind: AxisKind;
  unit: Vec3; // 이동/회전 축의 단위 벡터 (기계 좌표)
  min?: number;
  max?: number;
}

export interface Tool {
  id: string;
  diameterMm: number;
  /** 공구 길이 보정(스핀들 기준 Z-) */
  lengthMm: number;
}

/** 표준 3축 카테시안 밀링 정의 */
export const MILL_3AXIS: AxisConfig[] = [
  { name: 'X', kind: 'linear', unit: { x: 1, y: 0, z: 0 } },
  { name: 'Y', kind: 'linear', unit: { x: 0, y: 1, z: 0 } },
  { name: 'Z', kind: 'linear', unit: { x: 0, y: 0, z: 1 } },
];

export interface Machine {
  id: string;
  axes: AxisConfig[];
  /** 급속 이송 속도(mm/min) */
  rapidRateMmMin: number;
}

export const defaultMill = (): Machine => ({
  id: 'mill-3axis',
  axes: MILL_3AXIS,
  rapidRateMmMin: 10000,
});

export type SpindleState = 'off' | 'cw' | 'ccw';

/** 트윈의 단일 상태원(실측/시뮬 공통 정규화 대상). */
export interface MachineState {
  /** 축 이름 → 지령값(mm 또는 도) */
  axis: Record<string, number>;
  spindle: SpindleState;
  spindleRpm: number;
  feedMmMin: number;
  tool?: Tool;
  alarms: string[];
}

export const initialState = (): MachineState => ({
  axis: { X: 0, Y: 0, Z: 0 },
  spindle: 'off',
  spindleRpm: 0,
  feedMmMin: 0,
  alarms: [],
});
