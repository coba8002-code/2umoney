/** Figma 플러그인 UI 캡처용 분석 결과 픽스처 생성 */
import { writeFileSync } from 'node:fs';
import { scanNodes, type A11yNode } from '../src/index';

const screen: A11yNode[] = [
  {
    id: 'card',
    type: 'container',
    name: '상품 카드',
    bgColor: '#ffffff',
    children: [
      { id: 'hero', type: 'image', name: '대표 이미지', altText: null },
      { id: 'title', type: 'text', name: '제목 / 무선 이어폰', fgColor: '#222222', bgColor: '#ffffff', fontSizePx: 20, bold: true },
      { id: 'desc', type: 'text', name: '설명 / 연회색', fgColor: '#aaaaaa', bgColor: '#ffffff', fontSizePx: 14 },
      { id: 'price', type: 'text', name: '가격 / 노랑', fgColor: '#ffd54f', bgColor: '#ffffff', fontSizePx: 16, bold: true },
      { id: 'buy', type: 'button', name: '구매하기', label: '구매하기', fgColor: '#ffffff', bgColor: '#1976d2', width: 120, height: 36 },
      { id: 'search', type: 'input', name: '검색 입력', label: null, width: 220, height: 40 },
      { id: 'detail', type: 'link', name: '자세히 보기', fgColor: '#1976d2', bgColor: '#ffffff', fontSizePx: 14, focusable: true, hasVisibleFocusStyle: false, label: '자세히 보기' },
    ],
  },
];

const result = scanNodes(screen);
const out = '/tmp/claude-0/-home-user-2umoney/e8ece91c-7181-5378-8fb6-e0d5d22f280b/scratchpad/result.json';
writeFileSync(out, JSON.stringify(result));
console.log(`wrote ${out} — findings: ${result.findings.length}, fail: ${result.summary.fail}`);
