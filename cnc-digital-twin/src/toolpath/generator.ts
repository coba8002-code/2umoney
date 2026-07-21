/**
 * G코드 프로그램 → 공구 경로(ToolpathPoint[]) + 가공시간 추정.
 * 지원: G0/G1(직선), G2/G3(원호, XY평면 I/J 또는 R), G90/G91(절대/상대),
 *       G20/G21(inch/mm), F(이송), S(스핀들), M3/M4/M5.
 * 원호는 arcSegmentDeg 간격으로 선분 근사(헬리컬 Z 보간 포함).
 */
import { distance, type Vec3 } from '../domain/types';
import type { GLine } from '../gcode/parser';

export type MoveKind = 'rapid' | 'feed';

export interface ToolpathPoint {
  x: number;
  y: number;
  z: number; // mm
  kind: MoveKind;
  feedMmMin: number; // 이 세그먼트 이송(급속은 rapidRate)
  tSec: number; // 프로그램 시작부터 누적 시간(초)
}

export interface ToolpathResult {
  points: ToolpathPoint[];
  cycleTimeSec: number;
  bounds: { min: Vec3; max: Vec3 };
  warnings: string[];
}

export interface GenerateOptions {
  rapidRateMmMin?: number;
  arcSegmentDeg?: number;
  /** 시작 위치(mm). 기본 원점 */
  start?: Vec3;
}

const INCH_TO_MM = 25.4;

export function generateToolpath(lines: GLine[], opts: GenerateOptions = {}): ToolpathResult {
  const rapidRate = opts.rapidRateMmMin ?? 10000;
  const arcSegDeg = opts.arcSegmentDeg ?? 5;
  const warnings: string[] = [];

  // 모달 상태
  let unitScale = 1; // mm 기준(=1). inch 모드면 25.4
  let absolute = true; // G90
  let motion: 0 | 1 | 2 | 3 = 0; // 현재 이동 모드
  let feed = 0; // mm/min

  let pos: Vec3 = { ...(opts.start ?? { x: 0, y: 0, z: 0 }) };
  const points: ToolpathPoint[] = [{ ...pos, kind: 'rapid', feedMmMin: rapidRate, tSec: 0 }];
  let tSec = 0;

  const min: Vec3 = { ...pos };
  const max: Vec3 = { ...pos };
  const track = (p: Vec3) => {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  };

  const pushPoint = (p: Vec3, kind: MoveKind, segLen: number) => {
    const rate = kind === 'rapid' ? rapidRate : feed;
    if (kind === 'feed' && rate <= 0) {
      warnings.push('이송속도(F)가 지정되지 않아 시간 추정에서 제외된 세그먼트가 있습니다.');
    }
    const dt = rate > 0 ? (segLen / rate) * 60 : 0;
    tSec += dt;
    points.push({ ...p, kind, feedMmMin: kind === 'rapid' ? rapidRate : feed, tSec });
    track(p);
  };

  /** 절대/상대 + 단위 반영해 목표 좌표 산출 (지정 안 된 축은 유지) */
  const resolveTarget = (get: (l: string) => number | undefined): Vec3 => {
    const axis = (cur: number, raw: number | undefined): number => {
      if (raw === undefined) return cur;
      const val = raw * unitScale;
      return absolute ? val : cur + val;
    };
    return { x: axis(pos.x, get('X')), y: axis(pos.y, get('Y')), z: axis(pos.z, get('Z')) };
  };

  for (const line of lines) {
    const get = (letter: string): number | undefined => {
      const w = line.words.find((x) => x.letter === letter);
      return w?.value;
    };

    // 모달 갱신 (G/M/F/S)
    for (const w of line.words) {
      if (w.letter === 'G') {
        switch (w.value) {
          case 0: motion = 0; break;
          case 1: motion = 1; break;
          case 2: motion = 2; break;
          case 3: motion = 3; break;
          case 20: unitScale = INCH_TO_MM; break;
          case 21: unitScale = 1; break;
          case 90: absolute = true; break;
          case 91: absolute = false; break;
          case 17: break; // XY 평면(기본)
          case 18: case 19:
            warnings.push(`G${w.value}(비 XY 평면)은 아직 미지원 — XY 로 처리합니다.`);
            break;
          default: break;
        }
      }
      if (w.letter === 'F') feed = w.value * unitScale;
    }

    const hasMove = ['X', 'Y', 'Z', 'I', 'J', 'R'].some((l) => get(l) !== undefined);
    if (!hasMove) continue;

    const target = resolveTarget(get);

    if (motion === 0 || motion === 1) {
      pushPoint(target, motion === 0 ? 'rapid' : 'feed', distance(pos, target));
      pos = target;
    } else {
      // 원호 (G2 CW / G3 CCW), XY 평면
      const ccw = motion === 3;
      const arc = interpolateArc(pos, target, get, ccw, arcSegDeg, unitScale, warnings);
      for (const p of arc) {
        pushPoint(p, 'feed', distance(pos, p));
        pos = p;
      }
    }
  }

  return { points, cycleTimeSec: tSec, bounds: { min, max }, warnings };
}

/** XY 평면 원호를 선분 배열로 근사(끝점은 target 으로 스냅). z 는 헬리컬 선형보간. */
function interpolateArc(
  start: Vec3,
  end: Vec3,
  get: (l: string) => number | undefined,
  ccw: boolean,
  arcSegDeg: number,
  unitScale: number,
  warnings: string[],
): Vec3[] {
  const iRaw = get('I');
  const jRaw = get('J');
  const rRaw = get('R');

  let cx: number;
  let cy: number;
  if (iRaw !== undefined || jRaw !== undefined) {
    cx = start.x + (iRaw ?? 0) * unitScale;
    cy = start.y + (jRaw ?? 0) * unitScale;
  } else if (rRaw !== undefined) {
    const c = centerFromRadius(start, end, rRaw * unitScale, ccw);
    if (!c) {
      warnings.push('원호 반지름(R)로 중심을 계산할 수 없어 직선으로 대체했습니다.');
      return [end];
    }
    cx = c.x;
    cy = c.y;
  } else {
    warnings.push('원호에 I/J 또는 R 이 없어 직선으로 대체했습니다.');
    return [end];
  }

  const r = Math.hypot(start.x - cx, start.y - cy);
  const a0 = Math.atan2(start.y - cy, start.x - cx);
  const a1 = Math.atan2(end.y - cy, end.x - cx);

  let sweep = ccw ? a1 - a0 : a0 - a1; // 진행 방향 기준 양수 크기
  while (sweep <= 1e-9) sweep += Math.PI * 2; // 동일점(전원)이면 한 바퀴

  const steps = Math.max(1, Math.ceil((sweep * (180 / Math.PI)) / arcSegDeg));
  const dir = ccw ? 1 : -1;
  const out: Vec3[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ang = a0 + dir * sweep * t;
    const z = start.z + (end.z - start.z) * t;
    if (i === steps) {
      out.push({ x: end.x, y: end.y, z: end.z }); // 부동소수 드리프트 방지: 정확히 목표로
    } else {
      out.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), z });
    }
  }
  return out;
}

/** R 지정 원호의 중심 계산(부호 있는 R: 양수=단호<180°, 음수=우호>180°). */
function centerFromRadius(start: Vec3, end: Vec3, R: number, ccw: boolean): { x: number; y: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > Math.abs(R) * 2 + 1e-9) return null;
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const h = Math.sqrt(Math.max(0, R * R - (d / 2) * (d / 2)));
  // 현에 수직인 단위벡터
  const ux = -dy / d;
  const uy = dx / d;
  // R 부호와 회전방향으로 중심 측 결정
  const sign = (R >= 0 ? 1 : -1) * (ccw ? 1 : -1);
  return { x: mx + sign * h * ux, y: my + sign * h * uy };
}
