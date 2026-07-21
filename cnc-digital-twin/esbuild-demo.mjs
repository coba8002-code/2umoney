// demo/run.ts 를 번들해서 실행 (TS 인라인, node 런타임)
import * as esbuild from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const out = resolve('demo/run.mjs');
await esbuild.build({
  entryPoints: ['demo/run.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
});
await import(pathToFileURL(out).href);
