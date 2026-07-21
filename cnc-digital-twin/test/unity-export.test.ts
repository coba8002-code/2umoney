import { describe, it, expect } from 'vitest';
import { parseProgram } from '../src/gcode/parser';
import { generateToolpath } from '../src/toolpath/generator';
import { toUnityToolpath, toUnityToolpathJson, toUnityHeightfield } from '../src/export/unity';
import { createHeightfield } from '../src/sim/heightfield';

const build = (src: string) =>
  toUnityToolpath(generateToolpath(parseProgram(src), { rapidRateMmMin: 10000, arcSegmentDeg: 5 }));

describe('P2 — Unity 경로 계약', () => {
  it('필드명·구조가 JsonUtility 계약과 일치한다', () => {
    const doc = build('G21 G90\nG0 X10\nG1 X10 Y10 F600');
    expect(doc.units).toBe('mm');
    expect(doc).toHaveProperty('cycleTimeSec');
    expect(doc).toHaveProperty('pointCount', doc.points.length);
    expect(doc.bounds.min).toHaveProperty('x');
    expect(doc.bounds.max).toHaveProperty('z');
    const p = doc.points[0];
    expect(Object.keys(p).sort()).toEqual(['feedMmMin', 'kind', 'tSec', 'x', 'y', 'z']);
    expect(['rapid', 'feed']).toContain(p.kind);
  });

  it('tSec 는 단조 증가(재생 타임라인 보장)', () => {
    const doc = build('G21 G90\nG0 X50\nG1 X0 F600\nG3 X10 Y10 I10 J0 F600');
    for (let i = 1; i < doc.points.length; i++) {
      expect(doc.points[i].tSec).toBeGreaterThanOrEqual(doc.points[i - 1].tSec);
    }
    expect(doc.points[doc.points.length - 1].tSec).toBeCloseTo(doc.cycleTimeSec, 3);
  });

  it('JSON 문자열은 파싱 가능하고 좌표가 반올림된다', () => {
    const json = toUnityToolpathJson(generateToolpath(parseProgram('G21 G90\nG1 X0.123456 Y1 F600')));
    const parsed = JSON.parse(json);
    expect(parsed.points.some((p: { x: number }) => p.x === 0.1235)).toBe(true);
  });

  it('하이트필드 export 는 격자·z 배열 계약과 일치', () => {
    const hf = createHeightfield({ originX: 0, originY: 0, nx: 3, ny: 2, cellMm: 1, topZ: 0, bottomZ: -5 });
    hf.z[0] = -1.23456;
    const u = toUnityHeightfield(hf);
    expect(u).toMatchObject({ originX: 0, originY: 0, nx: 3, ny: 2, cellMm: 1 });
    expect(u.z).toHaveLength(6);
    expect(u.z[0]).toBe(-1.2346); // 4자리 반올림
  });
});
