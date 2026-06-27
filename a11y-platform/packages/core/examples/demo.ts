/**
 * 코어 엔진 데모 — Figma 없이 접근성 진단·보정·리포트를 콘솔로 확인.
 * 실행: pnpm --filter @app/core demo
 */
import { scanNodes, nearestPassingColor, contrastRatio, reportToText, type A11yNode } from '../src/index';

// 가상의 디자인 화면(샘플 노드 트리)
const screen: A11yNode[] = [
  {
    id: 'card',
    type: 'container',
    name: '상품 카드',
    bgColor: '#ffffff',
    children: [
      { id: 't1', type: 'text', name: '제목', fgColor: '#222222', bgColor: '#ffffff', fontSizePx: 20, bold: true },
      { id: 't2', type: 'text', name: '설명(연회색)', fgColor: '#aaaaaa', bgColor: '#ffffff', fontSizePx: 14 },
      { id: 'price', type: 'text', name: '가격(노랑)', fgColor: '#ffd54f', bgColor: '#ffffff', fontSizePx: 16 },
      { id: 'buy', type: 'button', name: '구매', label: '구매', fgColor: '#ffffff', bgColor: '#1976d2', width: 120, height: 36 },
      { id: 'fav', type: 'button', name: '♥', width: 32, height: 32 }, // 레이블 없음 + 44px 미만
      { id: 'hero', type: 'image', name: '대표 이미지' }, // alt 없음
    ],
  },
];

const { findings, summary } = scanNodes(screen);

console.log('\n===== 진단 결과 =====');
for (const f of findings.filter((f) => f.status === 'fail')) {
  console.log(`\n[${f.severity}] ${f.nodeName}  (${f.ruleId})`);
  console.log(`  기준: ${f.criterion}`);
  console.log(`  설명: ${f.message}`);
  if (f.fix) console.log(`  보정 제안: ${JSON.stringify(f.fix.after)}  (영향: ${f.fix.styleImpact})`);
}

console.log('\n===== 색 보정 단독 데모 (스타일 유지) =====');
for (const [fg, bg] of [['#aaaaaa', '#ffffff'], ['#ffd54f', '#ffffff'], ['#1976d2', '#90caf9']]) {
  const r = nearestPassingColor(fg, bg, 4.5);
  console.log(
    `${fg} on ${bg}: ${contrastRatio(fg, bg).toFixed(2)}:1 → ${r.color} (${r.ratio.toFixed(2)}:1, ${r.adjusted})`,
  );
}

console.log('\n===== 리포트 요약 =====');
console.log(reportToText({ findings, summary }));
