// TS 데모를 번들 후 즉시 실행 (별도 빌드 산출물 없이)
import * as esbuild from 'esbuild';
import { pathToFileURL } from 'node:url';

const entry = process.argv[2];
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  loader: { '.json': 'json' },
});
const code = result.outputFiles[0].text;
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
await import(dataUrl);
void pathToFileURL;
