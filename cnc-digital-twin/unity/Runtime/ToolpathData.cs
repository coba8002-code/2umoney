// P2: TS 코어가 export 한 Unity 경로 계약(JSON) 역직렬화용 데이터 클래스.
// 필드명은 src/export/unity.ts 의 UnityToolpathDoc 와 1:1 로 일치해야 한다(JsonUtility).
using System;
using UnityEngine;

namespace CncTwin
{
    [Serializable]
    public class UVec3
    {
        public float x, y, z;
        public Vector3 Raw => new Vector3(x, y, z);
    }

    [Serializable]
    public class UBounds
    {
        public UVec3 min;
        public UVec3 max;
    }

    [Serializable]
    public class UPoint
    {
        public float x, y, z;
        public string kind;       // "rapid" | "feed"
        public float feedMmMin;
        public float tSec;

        public Vector3 Mm => new Vector3(x, y, z);
        public bool IsRapid => kind == "rapid";
    }

    [Serializable]
    public class ToolpathDoc
    {
        public string units;      // "mm"
        public float cycleTimeSec;
        public int pointCount;
        public UBounds bounds;
        public UPoint[] points;
    }
}
