# 베리어프리 접근성 검증·자동보정 플랫폼

디자인·화면의 접근성(KWCAG 2.2 / WCAG 2.2 AA)을 자동으로 검사하고, 브랜드 톤을
해치지 않는 선에서 색·크기를 자동 보정하는 플랫폼입니다.

- 색·크기 보정은 **결정론적 알고리즘**(색상·채도 유지, 명도만 조정) — 디자인 훼손 없음
- 대체텍스트·문맥 판단은 **AI 보조** — 사람이 최종 검토·수락
- "100% 보장" 같은 단정 표현을 쓰지 않고, 자동 판정이 전체의 일부임을 항상 명시

> 코드는 모두 [`a11y-platform/`](./a11y-platform) 모노레포에 있습니다.

## 패키지

| 패키지 | 내용 |
|---|---|
| `packages/core` | 플랫폼 독립 룰셋·색대비·보정 알고리즘 (100% TS) |
| `packages/rules-data` | KWCAG/WCAG 매핑·임계값 (단일 소스) |
| `packages/figma-plugin` | Figma 진단·보정 플러그인 (Phase 1) |
| `packages/playground` | 브라우저 단독 웹 데모 (배포 대상) |
| `packages/ai` | AI 대체텍스트 계층 — 프로바이더 추상화 + 결정론 폴백 |
| `packages/api` | HTML/URL 검사 파이프라인 + REST 핸들러 (Phase 2) |

## 빠른 시작

```bash
cd a11y-platform
pnpm install
pnpm --filter @app/core test          # 룰셋·보정 단위 테스트
pnpm --filter @app/core demo          # 콘솔 데모 (진단·보정·리포트)
pnpm --filter @app/playground dev     # 웹 플레이그라운드
pnpm --filter @app/figma-plugin build # Figma 플러그인 빌드(dist/)
```

## 분석 API 서버 (CORS 제약 없는 URL·Figma 분석)

```bash
cd a11y-platform
CHROMIUM_PATH=/path/to/chromium pnpm --filter @app/api serve   # http://localhost:3001
# POST /v1/scan  { "source":"url",  "payload": { "url":"https://example.com" } }
# POST /v1/scan  { "source":"html", "payload": { "snapshot": <DomSnapshot> } }
# POST /v1/fix   { "scanResult": <ScanResult>, "acceptRuleIds": ["contrast.text"] }
# POST /v1/report  <ScanResult>
# POST /v1/alt   { "nodeId":"hero", "name":"photo", "surroundingText":"...", "dataUrl":"data:image/png;base64,..." }
```
URL 분석은 서버측 Playwright 가 실제 렌더링한 계산 스타일로 검사하므로 브라우저 CORS 제약이 없습니다.

### 멀티모달 대체텍스트 (C2)

`POST /v1/alt` 는 이미지 내용을 실제로 보고(`dataUrl`) 대체텍스트 초안을 제안합니다.
서버에 `ANTHROPIC_API_KEY` 가 설정돼 있으면 멀티모달 Claude(`claude-opus-4-8`)를,
없으면 네트워크 없이 동작하는 결정론 폴백(레이어명·주변 텍스트 기반)을 사용합니다.
API 키는 서버만 보관하고 클라이언트에 노출하지 않습니다.

```bash
ANTHROPIC_API_KEY=sk-... pnpm --filter @app/api serve
```

> AI 결과는 항상 `ai-assisted` 로 라벨링되고 신뢰도(confidence)가 함께 제공됩니다.
> 색·크기 보정은 결정론 코드가, **텍스트·판단 보조만 AI** 가 담당합니다 — 이 경계가 신뢰의 핵심입니다.
> 모든 AI 제안은 사람이 항목별로 수락한 뒤에만 적용됩니다(자동 적용 금지).

웹 플레이그라운드의 **이미지** 탭에서 "비전 LLM 서버" 주소(`https://host/v1/alt`)를 입력하면
브라우저가 직접 이 엔드포인트를 호출해 이미지 내용 기반 alt 를 받습니다(서버에 CORS 허용 포함).
비워 두면 네트워크 없이 동작하는 휴리스틱 초안으로 처리합니다.

### Docker 로 서버 배포

Chromium 이 포함된 Playwright 베이스 이미지를 사용합니다.

```bash
docker compose up --build          # http://localhost:3001
# 또는
docker build -t a11y-api . && docker run -p 3001:3001 a11y-api
```

`render.yaml`(또는 동일한 `Dockerfile`)로 Render·Railway·Fly.io 등에 그대로 배포할 수 있습니다.
정적 플레이그라운드는 Vercel/Pages 로, CORS-free 분석 서버는 이 컨테이너로 — 두 배포를 분리합니다.

## 배포

- **Vercel**: 루트 `vercel.json` 이 `@app/playground` 를 빌드해 단일 HTML 정적 사이트로 배포합니다.
- **GitHub Pages**: `.github/workflows/pages.yml` 이 같은 플레이그라운드를 Pages 로 배포합니다.
  (Settings → Pages → Source: GitHub Actions 활성화 필요)

## 문서

- [사용 설명서](./a11y-platform/docs/USER_GUIDE.md) — 기능·화면·활용 시나리오
- [기능 고도화 로드맵](./a11y-platform/docs/ROADMAP_FUNCTIONAL.md)
