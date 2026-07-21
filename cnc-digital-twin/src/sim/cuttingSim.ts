/**
 * P3: 절삭 시뮬레이션 (3축, 하이트필드).
 * 이송 세그먼트를 따라 공구를 진행시키며 표면을 낮춰 재료를 제거하고, 제거량을 적산한다.
 * 급속(rapid) 중 소재 관통 = 충돌, 축 지령이 기계 한계를 벗어나면 = 한계 위반.
 */
import type { ToolpathPoint } from '../toolpath/generator';
import type { Machine } from '../domain/types';
import { bottomOffset, type Cutter } from './tool';
import {
  cellCenter,
  fieldStats,
  inBounds,
  type Heightfield,
} from './heightfield';

export interface CutSimOptions {
  /** 경로 진행 샘플 간격(mm). 기본 = 셀 크기의 절반 */
  stepMm?: number;
  machine?: Machine;
}

export interface Collision {
  kind: 'rapid-into-stock' | 'axis-limit';
  message: string;
  at: { x: number; y: number; z: number };
  /** rapid-into-stock: 관통 깊이(mm) / axis-limit: 초과량(mm) */
  amountMm: number;
}

export interface CutResult {
  removedVolumeMm3: number;
  collisions: Collision[];
  finalStats: { minZ: number; maxZ: number };
  samples: number;
}

export function simulateCut(
  points: ToolpathPoint[],
  field: Heightfield,
  cutter: Cutter,
  opts: CutSimOptions = {},
): CutResult {
  const cfg = field.cfg;
  const step = opts.stepMm ?? cfg.cellMm / 2;
  const r = cutter.radiusMm;
  const cellArea = cfg.cellMm * cfg.cellMm;
  const collisions: Collision[] = [];
  let removed = 0;
  let samples = 0;

  // 축 한계 검사(옵션)
  const limitAxes = opts.machine?.axes.filter((a) => a.min !== undefined || a.max !== undefined) ?? [];
  const checkLimits = (p: ToolpathPoint) => {
    const val: Record<string, number> = { X: p.x, Y: p.y, Z: p.z };
    for (const a of limitAxes) {
      const v = val[a.name];
      if (v === undefined) continue;
      if (a.min !== undefined && v < a.min - 1e-9)
        collisions.push({ kind: 'axis-limit', message: `${a.name}축 하한 초과`, at: { x: p.x, y: p.y, z: p.z }, amountMm: a.min - v });
      if (a.max !== undefined && v > a.max + 1e-9)
        collisions.push({ kind: 'axis-limit', message: `${a.name}축 상한 초과`, at: { x: p.x, y: p.y, z: p.z }, amountMm: v - a.max });
    }
  };

  // 한 위치에서 공구 처리: feed 는 재료 제거, rapid 는 관통 깊이 산출(충돌은 세그먼트 단위로 집계)
  const processAt = (
    x: number,
    y: number,
    ztip: number,
    rapid: boolean,
  ): { pen: number; at: { x: number; y: number; z: number } } => {
    samples++;
    const cSpan = Math.ceil(r / cfg.cellMm) + 1;
    const ix0 = Math.floor((x - cfg.originX) / cfg.cellMm);
    const iy0 = Math.floor((y - cfg.originY) / cfg.cellMm);
    let maxPenetration = 0;
    let penAt = { x, y, z: ztip };
    for (let iy = iy0 - cSpan; iy <= iy0 + cSpan; iy++) {
      for (let ix = ix0 - cSpan; ix <= ix0 + cSpan; ix++) {
        if (!inBounds(cfg, ix, iy)) continue;
        const c = cellCenter(cfg, ix, iy);
        const d = Math.hypot(c.x - x, c.y - y);
        const off = bottomOffset(cutter, d);
        if (!isFinite(off)) continue;
        const toolBottom = ztip + off;
        const idx = iy * cfg.nx + ix;
        const surf = field.z[idx];
        if (toolBottom < surf - 1e-9) {
          if (rapid) {
            const pen = surf - toolBottom;
            if (pen > maxPenetration) {
              maxPenetration = pen;
              penAt = { x: c.x, y: c.y, z: toolBottom };
            }
          } else {
            const newZ = Math.max(cfg.bottomZ, toolBottom);
            if (newZ < surf) {
              removed += (surf - newZ) * cellArea;
              field.z[idx] = newZ;
            }
          }
        }
      }
    }
    return { pen: maxPenetration, at: penAt };
  };

  // 경로 세그먼트 진행
  for (let i = 0; i < points.length; i++) {
    checkLimits(points[i]);
    if (i === 0) continue;
    const a = points[i - 1];
    const b = points[i];
    const rapid = b.kind === 'rapid';
    const segLen = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const n = Math.max(1, Math.ceil(segLen / step));
    let segPen = 0;
    let segAt = { x: b.x, y: b.y, z: b.z };
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const res = processAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, rapid);
      if (rapid && res.pen > segPen) {
        segPen = res.pen;
        segAt = res.at;
      }
    }
    if (rapid && segPen > 0) {
      collisions.push({ kind: 'rapid-into-stock', message: '급속 이동 중 소재 관통', at: segAt, amountMm: segPen });
    }
  }

  return { removedVolumeMm3: removed, collisions, finalStats: fieldStats(field), samples };
}
