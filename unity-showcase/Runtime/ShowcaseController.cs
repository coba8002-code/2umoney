// 쇼케이스 오케스트레이션 — FBX 모델을 피벗에 배치하고 턴테이블·카메라·조명을 연결한다.
// 씬에 빈 GameObject 하나에 붙이고 modelRoot 에 FBX 인스턴스를 넣으면 자동 구성.
using UnityEngine;

namespace Showcase
{
    [DisallowMultipleComponent]
    public class ShowcaseController : MonoBehaviour
    {
        [Header("모델")]
        [Tooltip("FBX 를 씬에 넣은 루트. 비우면 이 오브젝트의 첫 자식 사용")]
        public Transform modelRoot;
        [Tooltip("모델을 원점에 자동 정렬하고 바운즈로 카메라 거리 자동 설정")]
        public bool autoFrame = true;

        [Header("연결(비우면 자동 생성)")]
        public ShowcaseTurntable turntable;
        public OrbitShowcaseCamera cam;
        public ShowcaseLighting lighting;

        void Start()
        {
            if (modelRoot == null && transform.childCount > 0) modelRoot = transform.GetChild(0);

            if (turntable == null) turntable = gameObject.AddComponent<ShowcaseTurntable>();
            turntable.target = modelRoot;

            if (lighting == null) lighting = gameObject.AddComponent<ShowcaseLighting>();
            lighting.target = modelRoot;

            if (cam == null)
            {
                var camGo = Camera.main != null ? Camera.main.gameObject : new GameObject("ShowcaseCamera");
                if (camGo.GetComponent<Camera>() == null) camGo.AddComponent<Camera>();
                cam = camGo.GetComponent<OrbitShowcaseCamera>() ?? camGo.AddComponent<OrbitShowcaseCamera>();
            }
            cam.pivot = modelRoot;
            cam.turntable = turntable;

            if (autoFrame && modelRoot != null) Frame(modelRoot, cam);
        }

        // 모델 바운즈로 카메라 거리·높이를 대략 맞춘다(제품이 화면에 꽉 차게).
        static void Frame(Transform model, OrbitShowcaseCamera cam)
        {
            var renderers = model.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return;
            var b = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++) b.Encapsulate(renderers[i].bounds);

            float radius = b.extents.magnitude;
            cam.distance = Mathf.Max(cam.minDistance, radius * 2.2f);
            cam.introFromDistance = cam.distance * 1.8f;
            cam.height = b.center.y - model.position.y + radius * 0.15f;
        }
    }
}
