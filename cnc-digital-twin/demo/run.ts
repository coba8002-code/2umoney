/** CLI 데모: G코드 파일 → 경로 요약(점 수·경계·가공시간·경고) 출력. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseProgram } from '../src/gcode/parser';
import { generateToolpath } from '../src/toolpath/generator';

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
