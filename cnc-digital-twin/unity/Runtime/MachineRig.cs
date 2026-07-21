// 3축 기계 리그 — 축 캐리지 Transform 과 공구 마커를 지령 좌표로 이동시킨다.
// 간단 버전: 각 축을 자기 방향으로 평행이동 + 공구 팁을 TCP 로 배치.
// (실제 갠트리 계층 구속은 P3 에서 정교화)
using UnityEngine;

namespace CncTwin
{
    public class MachineRig : MonoBehaviour
    {
        [Header("축 캐리지(선택)")]
        public Transform axisX; // +X 로 이동
        public Transform axisY; // +Z(Unity) 로 이동 (CNC Y)
        public Transform axisZ; // +Y(Unity) 로 이동 (CNC Z)

        [Header("공구")]
        public Transform toolTip;
        public float toolLengthMm = 0f;

        Vector3 _x0, _y0, _z0;
        bool _init;

        void Awake()
        {
            if (axisX) _x0 = axisX.localPosition;
            if (axisY) _y0 = axisY.localPosition;
            if (axisZ) _z0 = axisZ.localPosition;
            _init = true;
        }

        /// <summary>CNC mm 좌표로 축·공구를 이동.</summary>
        public void SetToolPositionMm(Vector3 mm)
        {
            if (!_init) Awake();
            float s = CoordinateMap.MmToUnity;

            if (axisX) axisX.localPosition = _x0 + new Vector3(mm.x * s, 0, 0);
            if (axisY) axisY.localPosition = _y0 + new Vector3(0, 0, mm.y * s);
            if (axisZ) axisZ.localPosition = _z0 + new Vector3(0, mm.z * s, 0);

            if (toolTip)
            {
                var tcp = mm + new Vector3(0, 0, -toolLengthMm); // 공구 길이 보정(-Z, CNC)
                toolTip.position = transform.TransformPoint(CoordinateMap.CncToUnity(tcp));
            }
        }
    }
}
