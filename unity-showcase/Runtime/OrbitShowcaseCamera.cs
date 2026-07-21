// 제품 쇼케이스 카메라 — 피벗을 중심으로 오비트. 자동 회전 + 마우스/터치 드래그,
// 시작 시 먼 곳에서 부드럽게 다가오는 인트로 돌리(dolly-in), 감쇠(damping) 적용.
using UnityEngine;

namespace Showcase
{
    public class OrbitShowcaseCamera : MonoBehaviour
    {
        [Header("피벗/거리")]
        public Transform pivot;
        public float distance = 3.0f;
        public float minDistance = 1.2f;
        public float maxDistance = 8f;
        public float height = 0.6f;

        [Header("각도")]
        public float yaw = 30f;
        public float pitch = 18f;
        public float minPitch = -5f;
        public float maxPitch = 75f;

        [Header("자동 회전")]
        public bool autoRotate = true;
        public float autoYawSpeed = 8f;
        [Tooltip("드래그 후 이 시간 뒤 자동 회전 재개(초)")]
        public float resumeAfter = 3f;

        [Header("입력/감쇠")]
        public float dragSpeed = 0.25f;
        public float zoomSpeed = 1.5f;
        public float damping = 10f;

        [Header("인트로 돌리")]
        public bool introDolly = true;
        public float introFromDistance = 6f;
        public float introSeconds = 1.8f;

        public ShowcaseTurntable turntable; // 드래그 중 턴테이블 일시정지 연동(선택)

        float _yaw, _pitch, _dist, _targetDist, _idle, _t;
        bool _dragging;
        Vector3 _lastPointer;

        void Start()
        {
            _yaw = yaw;
            _pitch = pitch;
            _targetDist = distance;
            _dist = introDolly ? introFromDistance : distance;
        }

        void Update()
        {
            _t += Time.deltaTime;
            HandleInput();

            // 인트로 돌리
            if (introDolly && _t < introSeconds)
            {
                float k = Mathf.SmoothStep(0f, 1f, _t / introSeconds);
                _dist = Mathf.Lerp(introFromDistance, _targetDist, k);
            }

            // 자동 회전(유휴 시)
            if (autoRotate && !_dragging && _idle >= resumeAfter)
                _yaw += autoYawSpeed * Time.deltaTime;

            _dist = Mathf.MoveTowards(_dist, _targetDist, Time.deltaTime * damping);
            _pitch = Mathf.Clamp(_pitch, minPitch, maxPitch);

            ApplyTransform();
        }

        void HandleInput()
        {
            bool down = Input.GetMouseButton(0);
            Vector3 pointer = Input.mousePosition;

            if (down && !_dragging)
            {
                _dragging = true;
                _lastPointer = pointer;
                turntable?.SetPaused(true);
            }
            else if (down && _dragging)
            {
                Vector3 d = pointer - _lastPointer;
                _yaw += d.x * dragSpeed;
                _pitch -= d.y * dragSpeed;
                _lastPointer = pointer;
                _idle = 0f;
            }
            else if (!down && _dragging)
            {
                _dragging = false;
                turntable?.SetPaused(false);
            }
            else
            {
                _idle += Time.deltaTime;
            }

            float scroll = Input.mouseScrollDelta.y;
            if (Mathf.Abs(scroll) > 0.001f)
            {
                _targetDist = Mathf.Clamp(_targetDist - scroll * zoomSpeed, minDistance, maxDistance);
                _idle = 0f;
            }
        }

        void ApplyTransform()
        {
            if (pivot == null) return;
            var focus = pivot.position + Vector3.up * height;
            var rot = Quaternion.Euler(_pitch, _yaw, 0f);
            var pos = focus + rot * new Vector3(0f, 0f, -_dist);
            transform.position = Vector3.Lerp(transform.position, pos, Mathf.Clamp01(Time.deltaTime * damping));
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(focus - transform.position), Mathf.Clamp01(Time.deltaTime * damping));
        }
    }
}
