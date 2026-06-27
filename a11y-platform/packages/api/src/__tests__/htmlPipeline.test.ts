import { describe, it, expect } from 'vitest';
import { cssColorToHex, snapshotToA11yNodes, type DomSnapshot } from '../htmlAdapter';
import { scanSnapshot, axeToFindings } from '../scanService';
import { handleScan, handleFix, handleReport } from '../routes';
import { contrastRatio, type Finding } from '@app/core';

const find = (fs: Finding[], ruleId: string) => fs.filter((f) => f.ruleId === ruleId);

describe('D — cssColorToHex', () => {
  it('rgb/rgba/hex 파싱', () => {
    expect(cssColorToHex('rgb(255, 136, 0)')).toBe('#ff8800');
    expect(cssColorToHex('#abc')).toBe('#aabbcc');
    expect(cssColorToHex('#aabbccdd')).toBe('#aabbcc');
  });
  it('투명색은 null (배경 상속 유도)', () => {
    expect(cssColorToHex('transparent')).toBeNull();
    expect(cssColorToHex('rgba(0,0,0,0)')).toBeNull();
  });
});

const SAMPLE: DomSnapshot = {
  root: {
    id: 'main',
    tag: 'main',
    style: { backgroundColor: 'rgb(255,255,255)' },
    children: [
      { id: 'h1', tag: 'h1', text: '제목', style: { color: 'rgb(34,34,34)', fontSizePx: 28, fontWeight: 700, lineHeightPx: 36 } },
      { id: 'h3', tag: 'h3', text: '소제목(레벨 건너뜀)', style: { color: 'rgb(34,34,34)', fontSizePx: 20, fontWeight: 700, lineHeightPx: 28 } },
      { id: 'p1', tag: 'p', text: '연회색 본문', style: { color: 'rgb(170,170,170)', fontSizePx: 14, lineHeightPx: 16 } },
      { id: 'a1', tag: 'a', text: '색만 다른 링크', attrs: { href: '#' }, style: { color: 'rgb(25,118,210)', fontSizePx: 14, textDecorationLine: 'none' } },
      { id: 'img1', tag: 'img', attrs: {}, rect: { width: 200, height: 120 } },
      { id: 'btn1', tag: 'button', text: '확인', style: { color: 'rgb(255,255,255)', backgroundColor: 'rgb(25,118,210)' }, rect: { width: 30, height: 28 } },
    ],
  },
};

describe('D — snapshotToA11yNodes', () => {
  it('태그 → 타입 매핑과 유효 배경 상속', () => {
    const [root] = snapshotToA11yNodes(SAMPLE);
    const kids = root.children!;
    expect(root.type).toBe('container');
    expect(kids.find((n) => n.id === 'h1')!.headingLevel).toBe(1);
    expect(kids.find((n) => n.id === 'p1')!.bgColor).toBe('#ffffff'); // 상속
    expect(kids.find((n) => n.id === 'a1')!.textDecoration).toBe('none');
    expect(kids.find((n) => n.id === 'img1')!.altText).toBeNull();
  });
});

describe('D — scanSnapshot (코어 룰 재사용)', () => {
  const result = scanSnapshot(SAMPLE);

  it('연회색 본문 대비 미달 검출 + 보정 재검증', () => {
    const f = find(result.findings, 'contrast.text').find((x) => x.nodeId === 'p1')!;
    expect(f.status).toBe('fail');
    expect(contrastRatio(f.fix!.after.fgColor as string, '#ffffff')).toBeGreaterThanOrEqual(4.5 - 0.01);
  });
  it('h1→h3 제목 건너뜀 검출', () => {
    expect(find(result.findings, 'heading.structure').some((f) => f.status === 'fail')).toBe(true);
  });
  it('밑줄 없는 링크 식별성 fail', () => {
    expect(find(result.findings, 'link.identifiable').some((f) => f.status === 'fail')).toBe(true);
  });
  it('alt 없는 이미지, 작은 버튼 검출', () => {
    expect(find(result.findings, 'img.alt').some((f) => f.status === 'fail')).toBe(true);
    expect(find(result.findings, 'target.size').some((f) => f.status === 'fail')).toBe(true);
  });
});

describe('D — axe 병합', () => {
  it('axe 위반을 axe.* Finding 으로 변환·병합', () => {
    const findings = axeToFindings([{ id: 'color-contrast', impact: 'serious', help: '대비 부족', nodes: [{ target: ['#x'] }] }]);
    expect(findings[0].ruleId).toBe('axe.color-contrast');
    expect(findings[0].severity).toBe('serious');
  });
  it('scanSnapshot 가 axe 결과를 합산', () => {
    const r = scanSnapshot(SAMPLE, { axeViolations: [{ id: 'region', impact: 'moderate' }] });
    expect(r.findings.some((f) => f.ruleId === 'axe.region')).toBe(true);
  });
});

describe('D — REST 핸들러', () => {
  it('handleScan html 정상', () => {
    const res = handleScan({ source: 'html', payload: { snapshot: SAMPLE } });
    expect(res.ok).toBe(true);
    expect(res.data!.findings.length).toBeGreaterThan(0);
  });
  it('handleScan url 은 501(서버 collect 안내)', () => {
    const res = handleScan({ source: 'url', payload: { url: 'https://x' } });
    expect(res.status).toBe(501);
  });
  it('handleScan html 스냅샷 누락 시 400', () => {
    const res = handleScan({ source: 'html', payload: {} });
    expect(res.status).toBe(400);
  });
  it('handleFix 는 수락한 룰만 diff 산출', () => {
    const scan = scanSnapshot(SAMPLE);
    const res = handleFix(scan, ['contrast.text']);
    expect(res.data!.diff.length).toBeGreaterThan(0);
    expect(res.data!.diff.every((d) => d.ruleId === 'contrast.text')).toBe(true);
  });
  it('handleReport 는 출처별 breakdown 포함', () => {
    const scan = scanSnapshot(SAMPLE);
    const res = handleReport(scan);
    expect(res.data!.breakdown).toBeDefined();
    expect(res.data!.generatedNote).toContain('자동');
  });
});
