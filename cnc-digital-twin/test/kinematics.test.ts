import { describe, it, expect } from 'vitest';
import { forwardKinematics } from '../src/kinematics/forward';
import { defaultMill } from '../src/domain/types';

describe('순운동학(3축)', () => {
  const m = defaultMill();

  it('선형축 지령이 TCP 로 합산된다', () => {
    const tcp = forwardKinematics(m, { X: 10, Y: 20, Z: 5 });
    expect(tcp).toEqual({ x: 10, y: 20, z: 5 });
  });

  it('공구 길이 보정은 -Z 로 반영', () => {
    const tcp = forwardKinematics(m, { X: 0, Y: 0, Z: 0 }, { id: 't1', diameterMm: 6, lengthMm: 50 });
    expect(tcp.z).toBe(-50);
  });

  it('미지정 축은 0 으로 처리', () => {
    const tcp = forwardKinematics(m, { X: 3 });
    expect(tcp).toEqual({ x: 3, y: 0, z: 0 });
  });
});
