# 기능 정의서 — 베리어프리 접근성 검증·자동보정 플랫폼

문서 버전: 2026-06 · 대상: KWCAG 2.2 / WCAG 2.2 AA

## 1. 목적 및 범위

디자인·화면의 접근성을 **자동 진단**하고, 브랜드 톤을 유지하는 선에서 **색·크기를 결정론적으로
보정**한다. 대체텍스트·문맥 판단만 AI 가 보조한다.

- **핵심 경계**: 색·레이아웃 보정은 **결정론 코드**, 텍스트·판단 보조만 **AI**.
- **컴플라이언스 경계(필수)**: "100% 보장"·"자동 인증 통과" 등 단정 표현 금지. 모든 판정은
  `auto / ai-assisted / manual` 로 출처를 명시하고, 통과율은 "자동판정 항목 기준" 으로만 표기한다.
  모든 보정은 사람이 항목별로 수락한 뒤 적용한다(자동 적용 금지).

## 2. 시스템 구성 (모노레포 패키지)

| 패키지 | 책임 |
|---|---|
| `@app/core` | 플랫폼 독립 룰셋·색대비·보정 알고리즘(결정론, 100% TS) |
| `@app/rules-data` | KWCAG/WCAG 매핑·임계값(단일 소스, `rules.json`) |
| `@app/ai` | AI 대체텍스트 계층 — 프로바이더 추상화 + 결정론 폴백 + 멀티모달 Claude |
| `@app/api` | 입력 어댑터(HTML/URL/Figma/Unity) + 검사 파이프라인 + REST 서버 |
| `@app/figma-plugin` | Figma 진단·보정 플러그인 |
| `@app/playground` | 브라우저 단독 웹 데모(단일 HTML, 배포 대상) |

## 3. 입력 소스 (5종)

| 입력 | 경로 | 정확도 | 비고 |
|---|---|---|---|
| **HTML** | 브라우저 단독 | 높음 | 코드 붙여넣기, 네트워크 불필요 |
| **URL** | 프록시(단독) / 서버 Playwright(권장) | 단독=중 / 서버=높음 | 서버 모드는 **동일 출처 크롤링** 지원 |
| **이미지** | 브라우저 / 비전 LLM(C2) | alt 보조 | 휴리스틱 또는 멀티모달 Claude |
| **Figma** | REST API | 중(휴리스틱 의미) | 토큰은 브라우저에서만 사용 |
| **Unity** | export JSON | 높음(실제 컴포넌트 값) | 키오스크. 비전 캡처 폴백 가능 |

정규화 어댑터는 모든 입력을 공통 `A11yNode` 트리로 변환해 **동일한 룰셋**에 통과시킨다.

## 4. 진단 룰셋 (자동 판정 항목)

`rules.json` 단일 소스 기준. 모두 결정론(`auto`).

| Rule ID | 심각도 | 기준(KWCAG / WCAG) | 자동 보정 |
|---|---|---|---|
| `contrast.text` | serious | KWCAG 5.3.1 / WCAG 1.4.3 명도 대비 | ✅ 색(명도) |
| `contrast.nonText` | serious | KWCAG 5.3.1 / WCAG 1.4.11 비텍스트 대비 | ✅ 색(명도) |
| `img.alt` | critical | KWCAG 5.1.1 / WCAG 1.1.1 대체 텍스트 | ✅ alt(AI 보조) |
| `control.label` | critical | KWCAG 6.4.2 / WCAG 4.1.2 레이블 | 가이드 |
| `target.size` | moderate | KWCAG 6.5.1 / WCAG 2.5.8 타깃 크기 | ✅ 크기 제안 |
| `text.size` | minor | KWCAG 가독성 / WCAG 1.4.4 | ✅ 크기 제안 |
| `focus.visible` | serious | KWCAG 6.4.1 / WCAG 2.4.7 포커스 표시 | 가이드 |
| `heading.structure` | moderate | KWCAG 7.1.1 / WCAG 1.3.1 제목 구조 | 가이드 |
| `text.lineHeight` | minor | WCAG 1.4.12 텍스트 간격(행간) | ✅ 값 제안 |
| `text.letterSpacing` | minor | WCAG 1.4.12 텍스트 간격(자간) | ✅ 값 제안 |
| `link.identifiable` | moderate | KWCAG 5.3.2 / WCAG 1.4.1 색 무관 인식 | 가이드 |

각 판정 결과(`Finding`)는 `status`(pass/fail/manual), `severity`, `source`, `confidence`,
`evidence`(예: 대비 2.32:1, 기준 4.5:1), `fix`(보정 제안)을 포함한다.

## 5. 색 보정 엔진 (결정론)

- **원리**: OKLCH 공간에서 **색상(H)·채도(C)를 고정**하고 **명도(L)만 이분탐색**으로 조정해
  목표 대비(텍스트 4.5:1 / 큰 글자·비텍스트 3:1)를 만족하는 최근접 색을 찾는다 → 브랜드 톤 유지.
- **확장 변형**: AA / AAA / **색각이상(CVD) 안전** 후보 산출.
- **다중 배경**: 그라데이션·반투명 겹침은 **최악(worst-case) 대비**로 판정.
- **출력**: `before → after` 와 styleImpact(none/minimal/visible). 사람 수락 후에만 적용.

## 6. 크기/구조 진단

- **타깃 크기**: 픽셀 폭·높이로 최소 44×44px(WCAG 2.5.8) 충족 검사 — 키오스크 핵심.
- **제목 구조**: 제목 레벨 건너뜀 등 정보 구조(1.3.1) 점검.
- **텍스트 간격**: 행간/자간 권장값(1.4.12) 점검.

## 7. AI 보조 계층 (이미지 대체텍스트, C2)

- **프로바이더 추상화**(`LlmProvider`): `suggestAltText`, `assessContextual`.
- **구현체**: ① `ClaudeAltProvider`(멀티모달 Claude, base64 이미지 입력) ② `HeuristicAltProvider`(네트워크 없는 폴백).
- **키 보관**: 서버 보관(`/v1/alt`, 권장) 또는 브라우저 직접 입력(즉석 시험용, `dangerouslyAllowBrowser`).
- **가드레일**: 결과는 항상 `ai-assisted` + `confidence`, 사람 수락 전 미적용. 장식 이미지는 빈 alt 제안.

## 8. REST API (분석 서버)

| 엔드포인트 | 기능 |
|---|---|
| `POST /v1/scan` | `{source:'html'\|'url', payload}` → `ScanResult` (url 은 서버 Playwright 수집) |
| `POST /v1/crawl` | `{url, options:{maxPages≤25, sameOrigin, pathPrefix}}` → 페이지별 결과 + 집계 |
| `POST /v1/fix` | `{scanResult, acceptRuleIds[]}` → 수락 항목의 결정론 보정 diff |
| `POST /v1/report` | `ScanResult` → 리포트(breakdown 포함) |
| `POST /v1/alt` | `ImageContext` → 대체텍스트 제안(`source:'ai-assisted'`) |
| `GET /health` | 헬스체크 |

- CORS 허용(브라우저 플레이그라운드에서 직접 호출 가능).
- 배포: Docker(Playwright 베이스 이미지), Render/Railway/Fly.io. 정적 플레이그라운드는 Vercel/Pages.

## 9. 수동(`manual`) 점검 항목 — 자동 판정 불가

다음은 코드/픽셀로 결론낼 수 없어 사람 점검으로 분류한다(특히 Unity·키오스크):

- 음성 안내(TTS)·점자·물리 버튼 제공 여부
- 포커스 이동 순서, 키패드/방향버튼 조작
- 휠체어 도달 높이·물리적 접근
- 시간제한 연장, 큰 글씨/고대비 모드, 동작 정지 수단

## 10. 비기능 요건

- **테스트**: 전 패키지 단위 테스트(현재 124개) + 실제 Chromium 크롤 e2e.
- **신뢰성 경계**: 결정론 산출물은 100% 재현, AI 산출물은 신뢰도 표기 + 사람 수락.
- **프라이버시**: API 키·Figma 토큰은 서버 보관 또는 브라우저 한정 사용, 저장·전송 없음(직접 입력 시).

---

화면별 사용법은 [사용 설명서](./USER_MANUAL.md), Unity 세부는 [UNITY_KIOSK.md](./UNITY_KIOSK.md) 참고.
