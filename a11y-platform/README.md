# 베리어프리 접근성 검증·자동보정 플랫폼

KWCAG 2.2 / WCAG 2.2 AA 기준의 접근성 진단·자동보정 플랫폼. 본 모노레포는 **Phase 1(Figma 플러그인)** 구현체와, Phase 2·3 확장을 위한 공통 코어를 포함한다.

> 📄 전체 명세는 `BUILD_SPEC`(핸드오프 스펙) 참고.

## 패키지 구조

```
packages/
  core/          # 접근성 룰셋·색대비·보정 로직 (플랫폼 독립, 100% TS)
  rules-data/    # KWCAG/WCAG 매핑·임계값 JSON (single source of truth)
  figma-plugin/  # Phase 1: 진단·보정 UI + Figma API 어댑터
```

핵심 원칙: **룰셋은 `packages/core`에 한 번만 구현**하고, 어댑터(Figma/HTML)가 입력을 공통 모델 `A11yNode`로 정규화해 넘긴다. 색·크기 보정은 **결정론적 코드**로 수행하고, AI는 텍스트/판단 보조에만 사용한다(환각으로 인한 디자인 훼손 방지).

## 빠른 시작

```bash
pnpm install
pnpm --filter @app/core test          # 룰셋 단위 테스트 (30 케이스)
pnpm --filter @app/figma-plugin build  # 플러그인 빌드 → packages/figma-plugin/dist/
```

Figma 데스크톱 → Plugins → Development → Import manifest → `packages/figma-plugin/manifest.json` 선택.

## 핵심 기능 (Phase 1)

- **색대비 진단**: WCAG 상대휘도 공식 (검증 케이스와 ±0.01 이내 일치).
- **스타일 유지 색 보정** (`nearestPassingColor`): 색상(H)·채도(C)는 고정하고 명도(L)만 LCH 공간에서 이분 탐색해 목표 대비를 만족하는 가장 가까운 색을 찾는다. 결과 hex로 **항상 재검증**하고, 실패 시 채도까지 낮추는 fallback.
- **자동 판정 룰**: `contrast.text`, `contrast.nonText`, `img.alt`, `control.label`, `target.size`(≥44px), `text.size`, `focus.visible`.
- **Figma 어댑터**: 노드 → `A11yNode` 정규화. 부모 체인을 추적해 **유효 배경색**을 산출.
- **보정 적용**: 색/크기 직접 적용, 동일 색의 **Variables(디자인 토큰)** 발견 시 토큰 바인딩 우선.
- **리포트 export**: JSON 요약 (auto / ai-assisted / manual 출처 구분 표기).

## 컴플라이언스 가드레일

- ❌ "접근성 100% 보장", "자동 인증 통과" 등 단정 표현을 UI·API 어디에도 쓰지 않는다. (FTC accessiBe 시정명령 사례)
- ✅ 모든 리포트에 `auto / ai-assisted / manual` 구분 표기.
- ✅ `estimatedPassRate`는 **"자동판정 항목 기준"**임을 항상 라벨링.
- ✅ 보정은 항상 사람이 항목별로 수락/거부 후 적용.

## 검증 상태

- `@app/core` 단위 테스트 30개 통과 (대비 정확도, 보정 후 재검증, 크기/alt/label 검출, 리포트 가드레일).
- `core`·`figma-plugin` 타입체크 클린, 플러그인 빌드 산출물 생성 확인.

## 향후 (Phase 2·3)

인터페이스·데이터 모델(`A11yNode`, `Finding`, `LlmProvider`)은 확장을 고려해 설계됨. Phase 2(HTML/axe-core + 웹·백엔드), Phase 3(NIA 키오스크 빌더)는 스펙 7·8장 참고.
