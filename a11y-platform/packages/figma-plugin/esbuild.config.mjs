import * as esbuild from 'esbuild';

/** Figma 메인 스레드(code.js) 빌드 — 샌드박스용 IIFE 번들 */
const options = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2017',
  loader: { '.json': 'json' },
  logLevel: 'info',
};

const watch = process.argv.includes('--watch');

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[esbuild] watching code.ts ...');
} else {
  await esbuild.build(options);
  console.log('[esbuild] built dist/code.js');
}
