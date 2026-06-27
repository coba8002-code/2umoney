// 프로덕션 서버 번들 생성: dist/serve.mjs (워크스페이스 TS 인라인, 런타임 deps external)
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync(resolve('dist'), { recursive: true });
await esbuild.build({
  entryPoints: ['src/serve.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: resolve('dist/serve.mjs'),
  external: ['fastify', 'playwright-core'],
  loader: { '.json': 'json' },
  minify: true,
});
console.log('[esbuild] built dist/serve.mjs');
