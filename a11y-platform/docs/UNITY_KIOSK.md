# Unity 키오스크 접근성 분석 가이드

Unity 는 모든 UI 를 **하나의 캔버스에 픽셀로 그립니다.** DOM·시맨틱 트리가 없어
OS 스크린리더가 버튼·텍스트를 인식하지 못하고, 구조 기반 자동 분석도 그대로는 불가능합니다.
그래서 이 플랫폼은 두 가지 경로를 제공합니다.

## 경로 1 — UI 계층 export (권장, 정확)

Unity 에서 UI 요소를 순회해 아래 JSON 으로 export 하면, **실제 좌표·색·폰트 값**으로
HTML/Figma 와 동일한 결정론 룰셋(명도대비·터치 타깃 크기·대체텍스트·폰트 크기)을 정확히 적용합니다.

플레이그라운드 **Unity 탭**에 붙여넣거나, `@app/api` 의 `unityExportToA11yNodes()` 로 처리합니다.

### export JSON 형식

```jsonc
{
  "screenBg": "#ffffff",            // 화면 배경(미지정 시 흰색 가정)
  "root": {                          // 또는 "nodes": [...] / 배열 / 단일 노드
    "id": "canvas", "kind": "Canvas", "backgroundColor": "#ffffff",
    "children": [
      { "id": "title", "kind": "TMP_Text", "text": "주문하기",
        "color": "#222222", "fontSizePx": 24 },
      { "id": "pay", "kind": "Button", "backgroundColor": "#1976d2",
        "rect": { "width": 220, "height": 64 },   // 화면 픽셀 기준
        "hasFocusVisual": true,
        "children": [{ "id": "lbl", "kind": "Text", "text": "결제",
                       "color": "#ffffff", "fontSizePx": 20 }] },
      { "id": "logo", "kind": "Image", "accessibilityLabel": "브랜드 로고",
        "rect": { "width": 120, "height": 40 } }
    ]
  }
}
```

| 필드 | 의미 |
|---|---|
| `kind` | `Text`/`TMP_Text`/`Button`/`Image`/`Toggle`/`InputField`/`Panel`/`Canvas` 등 |
| `color` | 전경(텍스트) 색 — hex `'#RRGGBB'` 또는 Unity Color `{r,g,b,a}`(0~1) |
| `backgroundColor` | 배경 색(Image/Panel fill) |
| `fontSizePx` | 화면 픽셀 환산 폰트 크기 |
| `rect.width/height` | **실제 렌더 픽셀 크기** — 터치 타깃 판정(KWCAG 2.2)에 직결 |
| `accessibilityLabel`/`altText` | 대체텍스트(없으면 이미지에서 `img.alt` 검출) |
| `interactable` | 상호작용 여부(미지정 시 kind 로 추론) |
| `hasFocusVisual` | 포커스 시 시각 표시 제공 여부 |

> export 스크립트는 Canvas 하위 RectTransform 을 DFS 로 돌며 위 필드를 채우면 됩니다.
> 좌표는 `RectTransform` 의 월드/스크린 크기를, 색은 `Graphic.color`/`TMP_Text.color` 를 사용하세요.

### 바로 쓰는 export 스크립트 (C#)

[`examples/unity/A11yUnityExporter.cs`](../examples/unity/A11yUnityExporter.cs) 를 `Assets/Editor/` 에 넣으면
메뉴 **Tools ▸ A11y ▸ Export UI JSON** 으로 위 형식의 JSON 을 파일+클립보드로 뽑아냅니다.
(legacy uGUI `Text`·`Image`·`Button`·`Toggle`·`InputField` 지원, TextMeshPro 는 `TMP_PRESENT`
스크립팅 디파인 추가 시 지원. 좌표·폰트는 화면 픽셀로 환산.)
출력 예시는 [`examples/unity/sample-export.json`](../examples/unity/sample-export.json) 참고.

## 경로 2 — 화면 캡처 + 비전 LLM (export 불가 시 폴백)

`ScreenCapture.CaptureScreenshot` 등으로 화면을 캡처해 **이미지** 탭(또는 `/v1/alt`)에 넣으면,
렌더된 픽셀에서 대비를 계산하고 비전 LLM 이 화면 요소를 설명·평가합니다. 단, 정적 한 장면이라
포커스 흐름·동적 상태는 여러 장 캡처하거나 수동 검토가 필요합니다.

## 코드로 분석 불가 → 수동(`manual`) 점검 항목

다음은 픽셀/구조로 자동 판정이 어려워 **사람 점검**이 필요합니다(자동 판정만으로 결론내리지 마세요).

- **음성 안내(TTS)** 와 점자/물리 버튼 제공 여부 — Unity 는 OS 스크린리더가 안 보이므로 앱이 직접 제공해야 함
- **포커스 이동 순서** 와 키패드/방향버튼 조작 가능성
- 휠체어 사용자 **화면 도달 높이**·물리적 접근(하드웨어 영역)
- 시간 제한(타임아웃) 연장 수단, 큰 글씨/고대비 모드 토글
- 동작·애니메이션 정지 수단(전정기관 민감)

자세한 KWCAG 2.2 매핑은 [USER_GUIDE](./USER_GUIDE.md) 를 참고하세요.
