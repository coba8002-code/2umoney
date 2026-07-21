import { describe, it, expect } from 'vitest';
import { parseProgram } from '../src/gcode/parser';
import { generateToolpath } from '../src/toolpath/generator';

const gen = (src: string) => generateToolpath(parseProgram(src), { rapidRateMmMin: 10000, arcSegmentDeg: 5 });

describe('경로 생성 — 직선/모달', () => {
  it('G90 절대 직선 이동의 끝점', () => {
    const r = gen('G21 G90\nG0 X10 Y0\nG1 X10 Y10 F600');
    const last = r.points[r.points.length - 1];
    expect(last).toMatchObject({ x: 10, y: 10, kind: 'feed' });
  });

  it('G91 상대 이동은 누적된다', () => {
    const r = gen('G21 G91\nG1 X5 F600\nG1 X5\nG1 Y10');
    const last = r.points[r.points.length - 1];
    expect(last.x).toBeCloseTo(10, 6);
    expect(last.y).toBeCloseTo(10, 6);
  });

  it('G20(inch)은 내부에서 mm 로 환산', () => {
    const r = gen('G20 G90\nG1 X1 F10'); // 1 inch = 25.4 mm
    const last = r.points[r.points.length - 1];
    expect(last.x).toBeCloseTo(25.4, 6);
  });

  it('급속(G0)은 rapidRate, 이송(G1)은 F 로 시간 추정', () => {
    // G0 X60 (60mm @10000mm/min=0.36s) + G1 X60→X0? 여기선 단순 확인
    const r = gen('G21 G90\nG0 X100\nG1 X0 F6000'); // feed 100mm @6000mm/min = 1s
    expect(r.cycleTimeSec).toBeCloseTo(0.6 / 1 + 1, 2); // rapid 100mm=0.6s + feed 1s
  });
});

describe('경로 생성 — 원호(G2/G3)', () => {
  it('G3(CCW) 1/4 원: (10,0)→(0,10), 중심 원점, 반지름 10', () => {
    const r = gen('G21 G90\nG1 X10 Y0 F600\nG3 X0 Y10 I-10 J0');
    const last = r.points[r.points.length - 1];
    expect(last.x).toBeCloseTo(0, 6);
    expect(last.y).toBeCloseTo(10, 6);
    // 모든 원호 점은 반지름 10 을 유지
    const arcPts = r.points.slice(-Math.ceil(90 / 5));
    for (const p of arcPts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 4);
  });

  it('G2(CW) 1/4 원: (10,0)→(0,10) 는 장호(270°)로 돈다', () => {
    // CW 로 (10,0)→(0,10)은 원점 중심에서 270° 경로
    const r = gen('G21 G90\nG1 X10 Y0 F600\nG2 X0 Y10 I-10 J0');
    // 경로 중 x<0 또는 y<0 인 점이 존재해야 장호(반대편)를 돈 것
    const wentAround = r.points.some((p) => p.x < -1 || p.y < -1);
    expect(wentAround).toBe(true);
  });

  it('전원(full circle): 시작=끝, I/J 지정 → 한 바퀴', () => {
    const r = gen('G21 G90\nG1 X10 Y0 F600\nG3 X10 Y0 I-10 J0');
    // 최북단(0,10)과 최남단(0,-10) 모두 지난다
    expect(r.points.some((p) => p.y > 9)).toBe(true);
    expect(r.points.some((p) => p.y < -9)).toBe(true);
  });
});

describe('경계 상자·경고', () => {
  it('bounds 가 이동 범위를 감싼다', () => {
    const r = gen('G21 G90\nG0 X0 Y0\nG1 X20 Y10 F600\nG1 Z-3');
    expect(r.bounds.max.x).toBeCloseTo(20, 6);
    expect(r.bounds.max.y).toBeCloseTo(10, 6);
    expect(r.bounds.min.z).toBeCloseTo(-3, 6);
  });

  it('F 없는 이송은 경고를 남긴다', () => {
    const r = gen('G21 G90\nG1 X10');
    expect(r.warnings.join()).toMatch(/이송속도/);
  });
});
