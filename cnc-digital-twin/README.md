# CNC 디지털트윈 (Unity) — 프로젝트

실제 CNC의 상태를 3D로 재현(트윈)하고, 도면·G코드로 가공을 미리 시뮬레이션하며,
충돌·과부하·불량을 사전에 잡아내는 **Unity 기반 디지털트윈**.

> 이 폴더는 **스프린트 0 (도메인 코어)** 입니다. 도메인 로직(G코드·운동학·경로)은 엔진에
> 독립적이라, 지금은 **검증된 TypeScript 레퍼런스**로 구현해 테스트로 정확성을 증명하고,
> Unity 단계에서 **C#로 1:1 포팅**합니다. (이 저장소엔 .NET 툴체인이 없어 C# 검증 불가 →
> 언어 무관 로직을 먼저 확정하는 것이 안전·최속)

## 확정된 스코프 (v0.1 가정)

| 항목 | 값 |
|---|---|
| 제품 성격 | 실시간 모니터링 + 가공 시뮬레이션 하이브리드 |
| Unity 역할 | 3D 실시간 시각화 + 운동학/절삭 시뮬레이션 |
| 대상 장비 | 3축 밀링(범용 축 아키텍처로 5축/선반 확장 여지) |
| 연동 | 설계는 MTConnect/OPC-UA·G코드/STEP 전제, **1차는 시뮬 우선(실장비 후순위)** |

## 단계별 로드맵

| Phase | 목표 | 상태 |
|---|---|---|
| P0 정의·설계 | 아키텍처·도메인 모델 확정 | ✅ |
| **P1 도메인 코어** | G코드 파서 + 3축 FK + 경로 생성 | ✅ (이 폴더) |
| **P2 Unity 트윈 뷰** | 경로 계약 export + C# 렌더/재생(`unity/`) | ✅ |
| **P3 절삭 시뮬** | 하이트필드 재료제거 + 충돌/한계 검사 + 소재 메시 | ✅ |
| P4 상태·대시보드 | MachineState 대시보드·알람·리포트 | ⏳ |
| P5 실장비 연동 | MTConnect/OPC-UA 어댑터 | ⏳ |
| P6 지능 | 예지보전·공구수명·품질예측 | ⏳ |

## 스프린트 0 산출물 (검증 완료)

- **도메인 모델** (`src/domain`): `Vec3`, 범용 `AxisConfig`, `Machine`, `Tool`, `MachineState`
- **G코드 파서** (`src/gcode`): 주석 제거, 워드 토큰화, 프로그램 파싱
- **순운동학** (`src/kinematics`): 축 지령 → 공구 선단(TCP), 공구 길이 보정
- **경로 생성기** (`src/toolpath`): G0/G1 직선, G2/G3 원호(I/J·R, 헬리컬), G90/G91, G20/G21,
  이송/급속 기반 **가공시간 추정**, 경계 상자, 경고
- **Unity 계약** (`src/export`): 경로·소재 하이트필드 → Unity(JsonUtility) JSON
- **절삭 시뮬** (`src/sim`, P3): 하이트필드(Z-map) 재료제거, 제거량 적산,
  flat/ball 공구, **급속 소재 충돌**·**축 한계** 검출
- **테스트 26개** + CLI 데모(경로·소재 JSON export)

## 실행

```bash
cd cnc-digital-twin
pnpm install
pnpm test        # 단위 테스트 16개
pnpm typecheck   # 타입 검사
pnpm demo        # 예제 G코드 → 경로 요약(점 수·경계·가공시간)
# 예: pnpm demo -- examples/square-pocket.gcode
```

데모 출력 예:
```
# CNC Twin — 경로 요약 (square-pocket.gcode)
G코드 라인       : 11
경로 점(points)  : 63
경계 X [0.00 .. 20.00] mm
경계 Y [-10.00 .. 20.00] mm
경계 Z [-1.00 .. 5.00] mm
추정 가공시간    : 29.09 s
경고: 없음
Unity 경로 export : square-pocket.toolpath.json
--- 절삭 시뮬(P3) ---
공구             : Ø3 flat
제거 부피        : 324.00 mm³
표면 Z [-1.00 .. 0.00] mm
충돌/한계        : 0건
Unity 소재 export : square-pocket.stock.json
```

Unity 연동(P2/P3)은 [`unity/README.md`](./unity/README.md) 참고 — 경로 재생 + 절삭 소재 메시.

## 다음 단계 (P4)

- MachineState 대시보드·알람·세션 리포트(가공시간·제거량·충돌 요약)
- G코드 → C# 포팅(이 TS 구현을 스펙 삼아 1:1) — 인엔진 라이브 편집용
