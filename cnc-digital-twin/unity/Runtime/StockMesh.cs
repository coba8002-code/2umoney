// P3: 절삭 후 소재 하이트필드(*.stock.json) → Unity 메시 생성.
// 격자 z 값으로 표면 메시를 만들어 "깎인 형상"을 시각화한다.
using System;
using UnityEngine;

namespace CncTwin
{
    [Serializable]
    public class HeightfieldDoc
    {
        public float originX, originY, cellMm;
        public int nx, ny;
        public float[] z; // 길이 nx*ny, idx = iy*nx+ix (mm)
    }

    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public class StockMesh : MonoBehaviour
    {
        public TextAsset stockJson;

        void Start()
        {
            if (stockJson != null) Build(JsonUtility.FromJson<HeightfieldDoc>(stockJson.text));
        }

        public void Build(HeightfieldDoc hf)
        {
            if (hf == null || hf.z == null || hf.nx < 2 || hf.ny < 2) return;

            var verts = new Vector3[hf.nx * hf.ny];
            for (int iy = 0; iy < hf.ny; iy++)
            for (int ix = 0; ix < hf.nx; ix++)
            {
                float x = hf.originX + (ix + 0.5f) * hf.cellMm;
                float y = hf.originY + (iy + 0.5f) * hf.cellMm;
                float zz = hf.z[iy * hf.nx + ix];
                verts[iy * hf.nx + ix] = CoordinateMap.CncToUnity(new Vector3(x, y, zz)); // (x, z, y)*s
            }

            var tris = new int[(hf.nx - 1) * (hf.ny - 1) * 6];
            int t = 0;
            for (int iy = 0; iy < hf.ny - 1; iy++)
            for (int ix = 0; ix < hf.nx - 1; ix++)
            {
                int a = iy * hf.nx + ix;
                int b = a + 1;
                int c = a + hf.nx;
                int d = c + 1;
                tris[t++] = a; tris[t++] = c; tris[t++] = b;
                tris[t++] = b; tris[t++] = c; tris[t++] = d;
            }

            var mesh = new Mesh { name = "StockSurface" };
            mesh.indexFormat = verts.Length > 65000
                ? UnityEngine.Rendering.IndexFormat.UInt32
                : UnityEngine.Rendering.IndexFormat.UInt16;
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            GetComponent<MeshFilter>().mesh = mesh;
        }
    }
}
