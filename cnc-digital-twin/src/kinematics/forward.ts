/**
 * 순운동학(Forward Kinematics) — 축 지령값 → 공구 선단(TCP) 좌표.
 * 범용 축 구성 기반. 현재는 선형축 합산(카테시안)을 지원하고,
 * 회전축은 P-후속 단계에서 변환 체인으로 확장한다(자리만 마련).
 */
import { addVec, scaleVec, vec3, type Machine, type Tool, type Vec3 } from '../domain/types';

export function forwardKinematics(
  machine: Machine,
  axisValues: Record<string, number>,
  tool?: Tool,
): Vec3 {
  let tcp = vec3(0, 0, 0);
  for (const axis of machine.axes) {
    const v = axisValues[axis.name] ?? 0;
    if (axis.kind === 'linear') {
      tcp = addVec(tcp, scaleVec(axis.unit, v));
    }
    // rotary: P-후속(회전 변환 체인). 현재 3축 범위에선 미사용.
  }
  // 공구 길이 보정: 스핀들 기준 -Z 로 공구가 뻗음
  if (tool) tcp = { ...tcp, z: tcp.z - tool.lengthMm };
  return tcp;
}
