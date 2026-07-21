// 제품 쇼케이스 — 대상(FBX 모델)을 부드럽게 회전시키는 턴테이블.
// 시작 시 ease-in, 선택적 미세 상하 부유(bob), 드래그 중 일시정지 지원.
using UnityEngine;

namespace Showcase
{
    public class ShowcaseTurntable : MonoBehaviour
    {
        [Header("대상")]
        [Tooltip("비우면 자기 자신을 회전")]
        public Transform target;

        [Header("회전")]
        public float degreesPerSecond = 18f;
        public Vector3 axis = Vector3.up;
        [Tooltip("시작 후 이 시간 동안 0→정속으로 가속(초)")]
        public float introSeconds = 1.5f;

        [Header("미세 부유(선택)")]
        public bool bob = false;
        public float bobAmplitude = 0.01f;
        public float bobFrequency = 0.5f;

        [Header("상호작용")]
        [Tooltip("드래그 중 자동 회전 일시정지")]
        public bool pauseWhileDragging = true;

        float _t;
        float _baseY;
        bool _paused;

        void Awake()
        {
            if (target == null) target = transform;
            _baseY = target.localPosition.y;
        }

        public void SetPaused(bool p) => _paused = p;

        void Update()
        {
            _t += Time.deltaTime;
            float ease = introSeconds > 0f ? Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(_t / introSeconds)) : 1f;

            if (!(pauseWhileDragging && _paused))
                target.Rotate(axis.normalized, degreesPerSecond * ease * Time.deltaTime, Space.World);

            if (bob)
            {
                var p = target.localPosition;
                p.y = _baseY + Mathf.Sin(_t * bobFrequency * Mathf.PI * 2f) * bobAmplitude;
                target.localPosition = p;
            }
        }
    }
}
