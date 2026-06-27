# Unity export 예시

유니티 키오스크 UI 를 베리어프리 분석 플랫폼이 받는 JSON 으로 내보내는 예시입니다.

| 파일 | 내용 |
|---|---|
| `A11yUnityExporter.cs` | 에디터 메뉴 export 스크립트. `Assets/Editor/` 에 배치 |
| `sample-export.json` | 스크립트가 만들어내는 JSON 출력 예시 |

## 사용

1. `A11yUnityExporter.cs` 를 프로젝트 `Assets/Editor/` 에 복사.
2. TextMeshPro 사용 시 **Player Settings → Scripting Define Symbols** 에 `TMP_PRESENT` 추가.
3. 메뉴 **Tools ▸ A11y ▸ Export UI JSON** 실행.
   - Canvas(또는 임의 GameObject)를 선택하면 그 하위만, 선택이 없으면 씬의 모든 루트 Canvas.
   - JSON 이 파일로 저장되고 클립보드에도 복사됩니다.
4. 저장된 JSON 을 웹 플레이그라운드의 **Unity 탭** 에 붙여넣고 **분석**.

> 좌표·폰트는 실행 시점의 화면 픽셀로 환산되므로, **실제 키오스크 해상도(Play 모드/빌드)** 에서
> 실행하면 터치 타깃 크기 판정이 가장 정확합니다.
>
> 자세한 형식·한계·수동 점검 항목은 [`../../docs/UNITY_KIOSK.md`](../../docs/UNITY_KIOSK.md) 참고.
