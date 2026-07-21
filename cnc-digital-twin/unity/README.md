# CNC Twin — Unity 트윈 뷰 (P2)

TS 코어가 export 한 경로 JSON(`*.toolpath.json`)을 Unity 에서 **3D 로 그리고 재생**한다.
Unity 는 G코드를 다시 해석하지 않는다 — 검증된 코어가 만든 경로/타임라인을 소비만 한다.

> 이 C# 스크립트는 이 저장소에 .NET/Unity 툴체인이 없어 **컴파일 검증은 하지 못했습니다**.
> 표준 UnityEngine API 만 사용했으며, 실제 Unity(2021 LTS+/6) 프로젝트에서 한 번 컴파일 확인이 필요합니다.
> 반대로 **경로 JSON 계약(필드·타임라인)** 은 TS 단위 테스트로 검증되어 있습니다.

## 구성

| 스크립트 | 역할 |
|---|---|
| `ToolpathData.cs` | JSON 계약 역직렬화 클래스(`ToolpathDoc`) — `src/export/unity.ts` 와 1:1 |
| `CoordinateMap.cs` | CNC(mm, Z=위) → Unity(m, Y=위) 좌표 변환 |
| `ToolpathRenderer.cs` | 이송=실선/급속=보조선 LineRenderer 렌더 |
| `MachineRig.cs` | 3축 캐리지·공구 마커를 지령 좌표로 이동 |
| `TwinPlayer.cs` | JSON 로드 + 타임라인(tSec) 재생(Play/Pause/Seek/배속) |

## 셋업 (5분)

1. Unity 프로젝트 생성(URP 권장). `unity/Runtime/*.cs` 를 `Assets/CncTwin/` 로 복사.
2. 경로 JSON 준비: 코어에서 `pnpm demo` 실행 → `examples/square-pocket.toolpath.json` 생성.
   그 파일을 `Assets/` 로 드래그하면 **TextAsset** 이 된다.
3. 씬 구성:
   - 빈 GameObject `Twin` 에 `TwinPlayer` 추가.
   - 자식 `Path` 에 `ToolpathRenderer` 추가 → `TwinPlayer.pathRenderer` 에 연결.
   - 빈 GameObject `Rig` 에 `MachineRig` 추가 → `TwinPlayer.rig` 에 연결.
     (선택) X/Y/Z 캐리지 큐브와 공구 마커를 만들어 각 필드에 할당.
   - `TwinPlayer.toolpathJson` 에 2)의 TextAsset 할당.
4. `feedMaterial`/`rapidMaterial` 에 URP/Unlit 머티리얼 지정.
5. Play ▶ — 공구가 경로를 따라 이동하고 이송/급속 경로가 그려진다. `speed` 로 배속.

## 좌표·단위

- 코어 단위는 **mm**. `CoordinateMap.MmToUnity`(기본 0.001)로 Unity 미터 환산.
- 축 매핑: CNC(X,Y,Z) → Unity(X, Z, Y). 기계 방향이 다르면 `CoordinateMap` 만 수정.

## 다음(P3)

- 소재 블록(Voxel/Dexel) + 이송 경로 스윕으로 **재료 제거** 시각화
- 축 한계·급속 중 절입 등 **충돌/경고**를 트윈에 오버레이
