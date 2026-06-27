import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 단일 HTML 로 빌드 → 로컬에서 더블클릭, GitHub Pages 등 어디서나 호스팅.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  css: { postcss: { plugins: [] } },
  build: { outDir: 'dist', emptyOutDir: true },
});
