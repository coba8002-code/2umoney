/** CLI 데모: G코드 파일 → 경로 요약(점 수·경계·가공시간·경고) 출력. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProgram } from '../src/gcode/parser';
import { generateToolpath } from '../src/toolpath/generator';
import { toUnityToolpathJson, toUnityHeightfieldJson } from '../src/export/unity';
import { heightfieldForBounds } from '../src/sim/heightfield';
import { flatEndmill } from '../src/sim/tool';
import { simulateCut } from '../src/sim/cuttingSim';

const file = process.argv[2] ?? resolve(import.meta.dirname, '../examples/square-pocket.gcode');
const src = readFileSync(file, 'utf8');
const lines = parseProgram(src);
const tp = generateToolpath(lines, { rapidRateMmMin: 10000, arcSegmentDeg: 5 });

const fmt = (n: number) => n.toFixed(2);
const mm = tp.bounds;
console.log(`# CNC Twin — 경로 요약 (${file.split('/').pop()})`);
console.log(`G코드 라인       : ${lines.length}`);
console.log(`경로 점(points)  : ${tp.points.length}`);
console.log(`경계 X [${fmt(mm.min.x)} .. ${fmt(mm.max.x)}] mm`);
console.log(`경계 Y [${fmt(mm.min.y)} .. ${fmt(mm.max.y)}] mm`);
console.log(`경계 Z [${fmt(mm.min.z)} .. ${fmt(mm.max.z)}] mm`);
console.log(`추정 가공시간    : ${fmt(tp.cycleTimeSec)} s`);
if (tp.warnings.length) console.log(`경고: ${[...new Set(tp.warnings)].join(' | ')}`);
else console.log('경고: 없음');

// P2: Unity 소비용 경로 JSON 도 함께 export
const outJson = file.replace(/\.gcode$/i, '') + '.toolpath.json';
writeFileSync(outJson, toUnityToolpathJson(tp), 'utf8');
console.log(`Unity 경로 export : ${outJson.split('/').pop()}`);

// P3: 절삭 시뮬 — 소재 하이트필드에서 재료 제거 + 충돌/한계 검사
const hf = heightfieldForBounds(mm.min, mm.max, { cellMm: 0.5, topZ: 0, bottomZ: mm.min.z - 1 });
const cut = simulateCut(tp.points, hf, flatEndmill(3), { stepMm: 0.25 });
console.log('--- 절삭 시뮬(P3) ---');
console.log(`공구             : Ø3 flat`);
console.log(`제거 부피        : ${fmt(cut.removedVolumeMm3)} mm³`);
console.log(`표면 Z [${fmt(cut.finalStats.minZ)} .. ${fmt(cut.finalStats.maxZ)}] mm`);
console.log(`충돌/한계        : ${cut.collisions.length}건${cut.collisions.length ? ' → ' + cut.collisions.map((c) => c.message).join(', ') : ''}`);
const hfJson = file.replace(/\.gcode$/i, '') + '.stock.json';
writeFileSync(hfJson, toUnityHeightfieldJson(hf), 'utf8');
console.log(`Unity 소재 export : ${hfJson.split('/').pop()}`);

