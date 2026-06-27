// 서버 진입점을 번들(워크스페이스 TS 인라인, 런타임 deps external) 후 실행.
import * as esbuild from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outfile = resolve('dist/serve.mjs');
mkdirSync(resolve('dist'), { recursive: true });

await esbuild.build({
  entryPoints: ['src/serve.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  external: ['fastify', 'playwright-core'], // node_modules 런타임 해석
  loader: { '.json': 'json' },
});

await import(pathToFileURL(outfile).href);
