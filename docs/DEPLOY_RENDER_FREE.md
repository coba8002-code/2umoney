# Render Free 배포 — 단계별 상세 가이드 (월 $0)

JUX 진단 API를 **무료로** 올리는 절차입니다. 경량 이미지(`Dockerfile.slim`)를 써서
키오스크 진단·HTML 스캔·대체텍스트·리포트가 동작합니다(URL 크롤만 제외).

> Render Free 특성: 15분 미사용 시 **슬립** → 첫 요청이 **콜드스타트(~30초)**. PoC·시연엔 충분.
> 상시 가동이 필요하면 Oracle Cloud Always Free VM 권장(README 참고).

---

## 사전 준비
- GitHub 계정 + 이 저장소(`coba8002-code/2umoney`) 접근
- (선택) Anthropic API 키 — 비전 LLM(`/v1/alt`) 쓸 때만. 없으면 결정론 폴백으로 동작
- 배포 대상 브랜치: **`claude/jinhaeng-679t9j`** (또는 main 병합 후 main)

## 1단계 — Render 가입
1. https://render.com 접속 → **Get Started** → **GitHub 계정으로 로그인**
2. Render가 GitHub 저장소 접근 권한 요청 → `2umoney` 저장소 허용

## 2단계 — Blueprint로 생성 (권장, 자동)
1. 대시보드 우상단 **New +** → **Blueprint**
2. `coba8002-code/2umoney` 저장소 선택
3. **Branch** 를 `claude/jinhaeng-679t9j` 로 지정
4. Render가 `render.slim.yaml` 을 자동 감지 → 서비스 `jux-api-slim` 표시
5. **Apply** 클릭 → 빌드 시작(Docker 이미지 빌드, 3~6분)

> 수동으로 하려면(2단계 대신): **New + → Web Service** → 저장소 선택 →
> Runtime **Docker**, Dockerfile Path `./Dockerfile.slim`, Plan **Free**,
> Health Check Path `/health`, 환경변수 `PORT=3001`.

## 3단계 — (선택) 비전 LLM 키 등록
1. 서비스 → **Environment** 탭 → **Add Environment Variable**
2. Key: `ANTHROPIC_API_KEY`, Value: `sk-ant-...` → Save
3. 미등록 시 `/v1/alt` 는 네트워크 없는 결정론 폴백으로 동작(무료)

## 4단계 — 배포 확인
1. 빌드 완료 후 서비스 URL 확인 (예: `https://jux-api-slim.onrender.com`)
2. 헬스체크:
   ```bash
   curl https://jux-api-slim.onrender.com/health
   # {"ok":true}
   ```
3. 키오스크 진단 호출:
   ```bash
   curl -s -X POST https://jux-api-slim.onrender.com/v1/kiosk/diagnose \
     -H 'content-type: application/json' \
     -d '{"screenSpec":{"diagonalInch":15.6,"widthPx":1920,"heightPx":1080},
          "elements":[{"id":"pay","kind":"button","boxPx":{"x":0,"y":0,"widthPx":40,"heightPx":40},"fgColor":"#fff","bgColor":"#1976d2"}]}'
   ```
   → 통과율·우선순위·수선분류가 담긴 리포트 JSON 반환(첫 호출은 콜드스타트로 느릴 수 있음).

## 5단계 — 프론트(웹 화면) 무료 배포
정적 플레이그라운드는 별도로 무료 호스팅:
- **Vercel**: 루트 `vercel.json` 이 자동 처리(이미 연결됨)
- **Cloudflare Pages**: New → Pages → 저장소 연결 → Build command
  `pnpm -C a11y-platform install --no-frozen-lockfile && pnpm -C a11y-platform --filter @app/playground build`,
  Output `a11y-platform/packages/playground/dist`

> 참고: 플레이그라운드의 **키오스크 진단 탭**은 진단 로직을 브라우저에서 직접 실행하므로,
> 단순 진단 시연은 **API 서버 없이도** 동작합니다. API 서버는 비전 LLM·대량 처리·저장 시 사용.

## 비용 정리
| 구성 | 서비스 | 월 비용 |
|---|---|---|
| 프론트 | Vercel / Cloudflare Pages | $0 |
| API | Render Free (Dockerfile.slim) | $0 |
| 비전 LLM | Anthropic 종량제 | 사용량만(안 쓰면 $0) |

## 콜드스타트가 싫다면
- **Oracle Cloud Always Free**(ARM 24GB, 상시): `Dockerfile.slim` 또는 `docker-compose.yml` 로 VM에 배포
- **Fly.io**: `fly launch` → `Dockerfile.slim`, scale-to-zero
- Render **Starter**($7): 슬립 없음
