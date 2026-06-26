import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

// UI(iframe) 를 단일 HTML(dist/index.html) 로 인라인 빌드.
// code.js 는 esbuild 가 별도로 생성하므로 emptyOutDir 를 끈다.
export default defineConfig({
  root: resolve(__dirname, 'src/ui'),
  plugins: [react(), viteSingleFile()],
  // 상위 저장소 postcss/tailwind 설정 탐색 차단
  css: { postcss: { plugins: [] } },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui/index.html'),
    },
  },
});
