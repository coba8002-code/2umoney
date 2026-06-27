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

## 배포

- **Vercel**: 루트 `vercel.json` 이 `@app/playground` 를 빌드해 단일 HTML 정적 사이트로 배포합니다.
- **GitHub Pages**: `.github/workflows/pages.yml` 이 같은 플레이그라운드를 Pages 로 배포합니다.
  (Settings → Pages → Source: GitHub Actions 활성화 필요)

## 문서

- [사용 설명서](./a11y-platform/docs/USER_GUIDE.md) — 기능·화면·활용 시나리오
- [기능 고도화 로드맵](./a11y-platform/docs/ROADMAP_FUNCTIONAL.md)
