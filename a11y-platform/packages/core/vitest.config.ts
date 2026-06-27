import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 상위 저장소의 postcss/tailwind 설정 탐색을 차단 (core 는 CSS 무관)
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
