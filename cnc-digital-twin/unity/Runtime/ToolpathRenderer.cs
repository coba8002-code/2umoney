// 경로를 LineRenderer 로 그린다: 이송(feed)=실선(굵게), 급속(rapid)=얇은 보조선.
// 연속 동일 kind 구간마다 자식 LineRenderer 를 생성한다.
using System.Collections.Generic;
using UnityEngine;

namespace CncTwin
{
    public class ToolpathRenderer : MonoBehaviour
    {
        public Material feedMaterial;
        public Material rapidMaterial;
        public float feedWidth = 0.002f;
        public float rapidWidth = 0.0008f;
        public Color feedColor = new Color(0.10f, 0.46f, 0.82f);
        public Color rapidColor = new Color(0.6f, 0.6f, 0.6f);

        readonly List<GameObject> _lines = new List<GameObject>();

        public void Clear()
        {
            foreach (var go in _lines)
                if (go != null) Destroy(go);
            _lines.Clear();
        }

        public void Build(ToolpathDoc doc)
        {
            Clear();
            if (doc == null || doc.points == null || doc.points.Length < 2) return;

            int i = 0;
            while (i < doc.points.Length - 1)
            {
                bool rapid = doc.points[i + 1].IsRapid;
                var run = new List<Vector3> { CoordinateMap.CncToUnity(doc.points[i]) };
                while (i < doc.points.Length - 1 && doc.points[i + 1].IsRapid == rapid)
                {
                    run.Add(CoordinateMap.CncToUnity(doc.points[i + 1]));
                    i++;
                }
                AddLine(run, rapid);
            }
        }

        void AddLine(List<Vector3> pts, bool rapid)
        {
            var go = new GameObject(rapid ? "rapid" : "feed");
            go.transform.SetParent(transform, false);
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = false;
            lr.positionCount = pts.Count;
            lr.SetPositions(pts.ToArray());
            lr.widthMultiplier = rapid ? rapidWidth : feedWidth;
            lr.numCornerVertices = 2;
            lr.material = rapid ? rapidMaterial : feedMaterial;
            lr.startColor = lr.endColor = rapid ? rapidColor : feedColor;
            _lines.Add(go);
        }
    }
}
