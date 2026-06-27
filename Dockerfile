# 접근성 분석 API 서버 (CORS 제약 없는 URL 수집 포함)
# Playwright 베이스 이미지 = Chromium 사전 설치 → URL 렌더 분석 가능
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# 워크스페이스만 복사 (빌드 캐시 최적화는 추후 분리)
COPY a11y-platform/ ./a11y-platform/
WORKDIR /app/a11y-platform

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @app/api build

ENV PORT=3001
# CHROMIUM_PATH 미설정 → playwright-core 가 베이스 이미지의 Chromium 자동 사용
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "packages/api/dist/serve.mjs"]
