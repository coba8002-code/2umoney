// 트윈 재생 컨트롤러 — 경로 JSON 을 로드해 경로를 그리고, 타임라인(tSec)을 따라
// 공구/축을 이동시킨다. Play/Pause/Scrub 지원.
using UnityEngine;

namespace CncTwin
{
    public class TwinPlayer : MonoBehaviour
    {
        [Header("입력")]
        public TextAsset toolpathJson;   // TS 코어가 export 한 *.toolpath.json
        public MachineRig rig;
        public ToolpathRenderer pathRenderer;

        [Header("재생")]
        public bool playOnStart = true;
        [Tooltip("재생 배속(1=실시간, 10=10배속)")]
        public float speed = 1f;
        public bool loop = true;

        public ToolpathDoc Doc { get; private set; }
        public float Time { get; private set; }
        public bool Playing { get; private set; }

        void Start()
        {
            if (toolpathJson != null) Load(toolpathJson.text);
            Playing = playOnStart;
        }

        public void Load(string json)
        {
            Doc = ToolpathLoader.FromJson(json);
            if (pathRenderer != null) pathRenderer.Build(Doc);
            Time = 0f;
            Apply();
        }

        void Update()
        {
            if (!Playing || Doc == null || Doc.cycleTimeSec <= 0f) return;
            Time += UnityEngine.Time.deltaTime * Mathf.Max(0f, speed);
            if (Time >= Doc.cycleTimeSec)
            {
                if (loop) Time %= Doc.cycleTimeSec;
                else { Time = Doc.cycleTimeSec; Playing = false; }
            }
            Apply();
        }

        public void Play() => Playing = true;
        public void Pause() => Playing = false;
        public void Seek(float tSec)
        {
            if (Doc == null) return;
            Time = Mathf.Clamp(tSec, 0f, Doc.cycleTimeSec);
            Apply();
        }

        void Apply()
        {
            if (Doc == null || rig == null) return;
            rig.SetToolPositionMm(PositionAtTime(Doc, Time));
        }

        /// <summary>타임라인 t(초)에서의 지령 좌표(mm)를 선형보간으로 산출.</summary>
        public static Vector3 PositionAtTime(ToolpathDoc doc, float t)
        {
            var pts = doc.points;
            if (pts == null || pts.Length == 0) return Vector3.zero;
            if (t <= pts[0].tSec) return pts[0].Mm;
            if (t >= pts[pts.Length - 1].tSec) return pts[pts.Length - 1].Mm;

            // 이진 탐색으로 t 를 감싸는 구간 찾기
            int lo = 0, hi = pts.Length - 1;
            while (hi - lo > 1)
            {
                int mid = (lo + hi) / 2;
                if (pts[mid].tSec <= t) lo = mid; else hi = mid;
            }
            float span = pts[hi].tSec - pts[lo].tSec;
            float u = span > 1e-6f ? (t - pts[lo].tSec) / span : 0f;
            return Vector3.Lerp(pts[lo].Mm, pts[hi].Mm, u);
        }
    }
}
