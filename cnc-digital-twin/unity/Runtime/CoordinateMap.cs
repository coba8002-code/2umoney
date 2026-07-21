// CNC 좌표(mm, Z=위) → Unity 좌표(m, Y=위) 변환.
// CNC: X右 Y안쪽 Z위. Unity: X右 Y위 Z앞. 기본 매핑 (X,Y,Z)cnc → (X,Z,Y)unity.
using UnityEngine;

namespace CncTwin
{
    public static class CoordinateMap
    {
        /// <summary>mm→m 스케일. 300mm 기계면 0.001로 30cm. 필요시 조정.</summary>
        public const float MmToUnity = 0.001f;

        public static Vector3 CncToUnity(Vector3 mm)
        {
            return new Vector3(mm.x, mm.z, mm.y) * MmToUnity;
        }

        public static Vector3 CncToUnity(UPoint p) => CncToUnity(p.Mm);
    }
}
