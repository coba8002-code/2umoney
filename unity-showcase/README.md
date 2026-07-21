# Unity 제품 쇼케이스 키트 (움직임 + 셰이딩 + 라이팅 + 고품질 룩)

FBX 모델을 **부드러운 턴테이블 회전 + 오비트 카메라(인트로 돌리)** 로 보여주고,
**3점 조명 + PBR 셰이딩 + 포스트프로세싱**으로 고품질로 렌더하는 드롭인 키트입니다.

> ⚠️ 이 스크립트는 이 저장소에 Unity 가 없어 **컴파일·렌더 검증은 하지 못했습니다**(표준 UnityEngine API 사용).
> 실제 Unity(2022 LTS+/6, **URP 권장**) 프로젝트에서 확인하세요. FBX·영상 모션은 아래 "튜닝"으로 맞춥니다.

## 구성

| 스크립트 | 역할 |
|---|---|
| `ShowcaseController` | FBX 배치 + 턴테이블/카메라/조명 자동 연결, 바운즈로 자동 프레이밍 |
| `ShowcaseTurntable` | 모델 회전(ease-in, 미세 부유, 드래그 시 일시정지) |
| `OrbitShowcaseCamera` | 오비트 카메라(자동회전 + 드래그 + 줌 + **인트로 돌리인**) |
| `ShowcaseLighting` | 키/필/림 3점 조명 자동 생성(soft shadow, 페이드인) |

## 빠른 시작 (5분)

1. `unity-showcase/Runtime/*.cs` 를 `Assets/Showcase/` 로 복사.
2. FBX 를 씬에 드래그 → 빈 GameObject `Showcase` 의 자식으로 넣기.
3. `Showcase` 에 **`ShowcaseController`** 추가 → `modelRoot` 에 FBX 인스턴스 지정(비우면 첫 자식 자동).
4. ▶ Play — 모델이 회전하고, 카메라가 먼 곳에서 다가오며, 3점 조명이 페이드인.

## 고품질 렌더 셋업 (핵심)

### 1) 렌더 파이프라인 — URP
- Project Settings → Graphics → **URP Asset** 지정. URP Asset 에서:
  - **HDR** 켜기, **MSAA 4x**, Shadow Distance 30~50, Cascades 4, Soft Shadows.

### 2) PBR 머티리얼 (FBX 임포트)
- FBX 선택 → Inspector → **Materials → Extract Materials**.
- 각 머티리얼을 **URP/Lit** 셰이더로:
  - Base Map(albedo), **Metallic/Smoothness**(또는 Metallic 맵), **Normal Map**(임포트 시 Texture Type=Normal map),
    **Occlusion(AO)**, 필요 시 Emission.
  - 금속 재질은 Metallic↑·Smoothness↑, 플라스틱은 Metallic 0·Smoothness 중간.

### 3) 환경광·반사 (룩의 90%)
- **HDRI 스카이박스**: Skybox 머티리얼(파노라마 HDRI) → Lighting → Environment → Skybox Material.
  - Environment Lighting Source=Skybox, Intensity 1.0, **Reflections Source=Skybox**.
- 모델 주변에 **Reflection Probe**(Baked/Realtime) 하나 → 금속·유리에 주변 반사가 잡힘.

### 4) 포스트프로세싱 (URP Volume)
- 씬에 **Global Volume** 추가 → New Profile → 아래 오버라이드:
  - **Tonemapping**: Mode **ACES** (필름 룩)
  - **Bloom**: Threshold ~1.1, Intensity 0.3~0.6 (하이라이트 글로우)
  - **Color Adjustments**: Post Exposure +0.1, Contrast +8, Saturation +6
  - **Ambient Occlusion**(SSAO, URP Renderer Feature): Intensity 0.5 (접촉 그림자)
  - **Vignette**: Intensity 0.25 (시선 집중)
  - **Depth of Field**(선택): Bokeh, 제품에 포커스 → 배경 흐림
- Camera 에 **Post Processing** 체크.

### 5) 바닥·그림자
- 은은한 **그라운드 플레인** + soft shadow 로 "떠 있지 않게".
- 배경은 단색 그라디언트 또는 스튜디오 HDRI.

## 영상 모션에 맞추는 튜닝

영상(https://youtu.be/vhThzDRjbiQ)의 움직임을 못 봤으니, 아래 파라미터로 맞춰주세요
(또는 **영상 속 움직임을 한두 문장으로 설명**해 주시면 기본값을 그에 맞게 바꿔 드립니다):

| 영상 느낌 | 조정 |
|---|---|
| 천천히 도는 제품 | `ShowcaseTurntable.degreesPerSecond` 10~20 |
| 카메라가 도는(제품 고정) | `turntable.degreesPerSecond=0`, `OrbitShowcaseCamera.autoRotate=true`, `autoYawSpeed` |
| 확 다가오는 인트로 | `introDolly=true`, `introFromDistance`↑, `introSeconds` |
| 위/아래로 훑기 | `OrbitShowcaseCamera.pitch` 애니메이션(또는 인트로 pitch 변화 추가) |
| 부유하는 느낌 | `ShowcaseTurntable.bob=true` |

## 필요 시 더 (요청 주세요)
- 영상 모션 정확 재현(설명/GIF 주시면 곡선·타이밍까지 매칭)
- 분해/조립(exploded view) 애니메이션, 하이라이트 콜아웃(핫스팟)
- WebGL 빌드로 브라우저 임베드(쇼케이스를 웹 페이지에)
