import { describe, it, expect } from 'vitest';
import type { ToolpathPoint } from '../src/toolpath/generator';
import { createHeightfield, getZ } from '../src/sim/heightfield';
import { flatEndmill, ballEndmill, bottomOffset } from '../src/sim/tool';
import { simulateCut } from '../src/sim/cuttingSim';
import type { Machine } from '../src/domain/types';
import { MILL_3AXIS } from '../src/domain/types';

const pt = (x: number, y: number, z: number, kind: 'rapid' | 'feed'): ToolpathPoint => ({
  x, y, z, kind, feedMmMin: kind === 'rapid' ? 10000 : 300, tSec: 0,
});

const stock = () =>
  createHeightfield({ originX: 0, originY: 0, nx: 40, ny: 40, cellMm: 1, topZ: 0, bottomZ: -10 });

describe('P3 공구 형상', () => {
  it('flat: 반경 안 0, 밖 무한', () => {
    expect(bottomOffset(flatEndmill(4), 1)).toBe(0);
    expect(bottomOffset(flatEndmill(4), 3)).toBe(Infinity);
  });
  it('ball: 구면 오프셋', () => {
    expect(bottomOffset(ballEndmill(4), 0)).toBeCloseTo(0, 6); // 팁 중심
    expect(bottomOffset(ballEndmill(4), 2)).toBeCloseTo(2, 6); // 반경 끝 = r
    expect(bottomOffset(ballEndmill(4), Math.SQRT2)).toBeCloseTo(2 - Math.sqrt(2), 6);
  });
});

describe('P3 재료 제거', () => {
  it('직선 이송 절삭이 표면을 낮추고 제거량을 적산한다', () => {
    const hf = stock();
    const path = [
      pt(10, 10, 5, 'rapid'),
      pt(10, 10, -1, 'feed'), // 절입
      pt(30, 10, -1, 'feed'), // 직선 절삭 (길이 20, 깊이 1)
    ];
    const res = simulateCut(path, hf, flatEndmill(4), { stepMm: 0.5 });
    // 경로 위 셀은 -1 로 내려감
    expect(getZ(hf, 20, 10)).toBeCloseTo(-1, 6);
    // 경로 밖 셀은 그대로
    expect(getZ(hf, 5, 30)).toBe(0);
    // 제거 부피 ≈ 20*4*1 + 원형 캡 ≈ 90 mm3
    expect(res.removedVolumeMm3).toBeGreaterThan(70);
    expect(res.removedVolumeMm3).toBeLessThan(115);
    expect(res.collisions).toHaveLength(0);
  });

  it('바닥(bottomZ) 아래로는 깎지 않는다(클램프)', () => {
    const hf = createHeightfield({ originX: 0, originY: 0, nx: 20, ny: 20, cellMm: 1, topZ: 0, bottomZ: -2 });
    const res = simulateCut([pt(10, 10, 5, 'rapid'), pt(10, 10, -5, 'feed')], hf, flatEndmill(4), { stepMm: 0.5 });
    expect(getZ(hf, 10, 10)).toBeCloseTo(-2, 6); // -5 가 아니라 -2 로 클램프
    expect(res.finalStats.minZ).toBeGreaterThanOrEqual(-2 - 1e-9);
  });
});

describe('P3 충돌·한계', () => {
  it('급속(G0)으로 소재에 파고들면 충돌을 보고한다', () => {
    const hf = stock();
    const res = simulateCut([pt(10, 10, 5, 'rapid'), pt(10, 10, -1, 'rapid')], hf, flatEndmill(4), { stepMm: 0.5 });
    const hit = res.collisions.find((c) => c.kind === 'rapid-into-stock');
    expect(hit).toBeTruthy();
    expect(hit!.amountMm).toBeGreaterThan(0.5);
    // 급속은 재료를 제거하지 않는다
    expect(res.removedVolumeMm3).toBe(0);
  });

  it('축 한계를 벗어나면 한계 위반을 보고한다', () => {
    const machine: Machine = {
      id: 'm',
      axes: MILL_3AXIS.map((a) => (a.name === 'Z' ? { ...a, min: -5 } : a)),
      rapidRateMmMin: 10000,
    };
    const hf = stock();
    const res = simulateCut([pt(0, 0, 0, 'rapid'), pt(10, 10, -10, 'feed')], hf, flatEndmill(4), { machine, stepMm: 1 });
    const lim = res.collisions.find((c) => c.kind === 'axis-limit');
    expect(lim).toBeTruthy();
    expect(lim!.message).toMatch(/Z축 하한/);
    expect(lim!.amountMm).toBeCloseTo(5, 6); // -10 은 하한 -5 를 5 초과
  });
});
