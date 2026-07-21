// 제품 쇼케이스 3점 조명 리그 — 키/필/림 라이트를 코드로 구성(할당 없으면 자동 생성).
// 고품질 제품 룩을 위한 기본값(부드러운 그림자·림 하이라이트·은은한 앰비언트).
// HDRI/스카이박스 반사는 README 참고(Environment + Reflection Probe).
using UnityEngine;

namespace Showcase
{
    public class ShowcaseLighting : MonoBehaviour
    {
        [Header("타깃(피벗)")]
        public Transform target;

        [Header("키 라이트(주광)")]
        public float keyIntensity = 1.6f;
        public Color keyColor = new Color(1f, 0.96f, 0.9f);
        public Vector2 keyAngles = new Vector2(50f, -35f); // pitch, yaw

        [Header("필 라이트(보조)")]
        public float fillIntensity = 0.5f;
        public Color fillColor = new Color(0.85f, 0.9f, 1f);
        public Vector2 fillAngles = new Vector2(25f, 55f);

        [Header("림 라이트(윤곽)")]
        public float rimIntensity = 1.1f;
        public Color rimColor = new Color(0.9f, 0.95f, 1f);
        public Vector2 rimAngles = new Vector2(15f, 170f);

        [Header("앰비언트")]
        [Range(0f, 1f)] public float ambient = 0.35f;

        [Header("페이드 인")]
        public bool fadeIn = true;
        public float fadeSeconds = 1.2f;

        Light _key, _fill, _rim;
        float _t;

        void Awake()
        {
            _key = MakeLight("Key", keyColor, keyIntensity, keyAngles, LightShadows.Soft);
            _fill = MakeLight("Fill", fillColor, fillIntensity, fillAngles, LightShadows.None);
            _rim = MakeLight("Rim", rimColor, rimIntensity, rimAngles, LightShadows.None);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(ambient, ambient, ambient * 1.05f);
        }

        Light MakeLight(string name, Color color, float intensity, Vector2 angles, LightShadows shadows)
        {
            var go = new GameObject($"Showcase_{name}");
            go.transform.SetParent(transform, false);
            go.transform.rotation = Quaternion.Euler(angles.x, angles.y, 0f);
            var l = go.AddComponent<Light>();
            l.type = LightType.Directional;
            l.color = color;
            l.intensity = fadeIn ? 0f : intensity;
            l.shadows = shadows;
            l.shadowStrength = 0.75f;
            return l;
        }

        void Update()
        {
            if (!fadeIn) return;
            _t += Time.deltaTime;
            float k = fadeSeconds > 0f ? Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(_t / fadeSeconds)) : 1f;
            _key.intensity = keyIntensity * k;
            _fill.intensity = fillIntensity * k;
            _rim.intensity = rimIntensity * k;
            if (k >= 1f) enabled = false;
        }
    }
}
