import { useMemo, useState } from 'react';
import {
  scanNodes,
  reportToJson,
  contrastRatio,
  type A11yNode,
  type Finding,
} from '@app/core';

/** 플레이그라운드용 편집 가능한 디자인 모델 (시각 미리보기 + 스캔 입력 겸용) */
interface DesignState {
  title: { text: string; fg: string };
  desc: { text: string; fg: string };
  price: { text: string; fg: string };
  bg: string;
  buyW: number;
  buyH: number;
  favLabeled: boolean;
  heroAlt: boolean;
}

const INITIAL: DesignState = {
  title: { text: '무선 이어폰', fg: '#222222' },
  desc: { text: '노이즈 캔슬링 · 24시간 재생', fg: '#aaaaaa' },
  price: { text: '129,000원', fg: '#ffd54f' },
  bg: '#ffffff',
  buyW: 120,
  buyH: 36,
  favLabeled: false,
  heroAlt: false,
};

function toNodes(d: DesignState): A11yNode[] {
  return [
    {
      id: 'card',
      type: 'container',
      name: '상품 카드',
      bgColor: d.bg,
      children: [
        { id: 'hero', type: 'image', name: '대표 이미지', altText: d.heroAlt ? '무선 이어폰 제품 사진' : null },
        { id: 'title', type: 'text', name: '제목', fgColor: d.title.fg, bgColor: d.bg, fontSizePx: 20, bold: true },
        { id: 'desc', type: 'text', name: '설명', fgColor: d.desc.fg, bgColor: d.bg, fontSizePx: 14 },
        { id: 'price', type: 'text', name: '가격', fgColor: d.price.fg, bgColor: d.bg, fontSizePx: 16, bold: true },
        { id: 'buy', type: 'button', name: '구매하기', label: '구매하기', fgColor: '#ffffff', bgColor: '#1976d2', width: d.buyW, height: d.buyH },
        { id: 'fav', type: 'button', name: '찜', label: d.favLabeled ? '찜하기' : null, width: 40, height: 40 },
      ],
    },
  ];
}

const SEVERITY_COLOR: Record<Finding['severity'], string> = {
  critical: '#d32f2f',
  serious: '#e65100',
  moderate: '#f9a825',
  minor: '#1976d2',
};
const SOURCE_LABEL: Record<Finding['source'], string> = { auto: '자동', 'ai-assisted': 'AI 보조', manual: '수동' };

export function App() {
  const [d, setD] = useState<DesignState>(INITIAL);
  const result = useMemo(() => scanNodes(toNodes(d)), [d]);
  const fails = result.findings.filter((f) => f.status === 'fail');
  const rate = Math.round(result.summary.estimatedPassRate * 100);

  /** Finding 의 보정 제안을 디자인 상태에 반영 */
  function applyFix(f: Finding) {
    setD((prev) => {
      const n = { ...prev };
      if (f.ruleId === 'contrast.text' && f.fix) {
        const after = f.fix.after.fgColor as string;
        if (f.nodeId === 'title') n.title = { ...n.title, fg: after };
        if (f.nodeId === 'desc') n.desc = { ...n.desc, fg: after };
        if (f.nodeId === 'price') n.price = { ...n.price, fg: after };
      }
      if (f.ruleId === 'target.size' && f.nodeId === 'buy') {
        n.buyW = Math.max(n.buyW, 44);
        n.buyH = Math.max(n.buyH, 44);
      }
      if (f.ruleId === 'control.label' && f.nodeId === 'fav') n.favLabeled = true;
      if (f.ruleId === 'img.alt' && f.nodeId === 'hero') n.heroAlt = true;
      return n;
    });
  }

  function applyAll() {
    fails.forEach(applyFix);
  }

  function downloadReport() {
    const blob = new Blob([reportToJson(result)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'a11y-report.json';
    a.click();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>접근성 검증·자동보정 <span className="tag">플레이그라운드</span></h1>
          <p className="sub">KWCAG 2.2 / WCAG 2.2 AA · 색·크기 보정은 결정론적 알고리즘, 텍스트/판단은 AI 보조</p>
        </div>
        <div className="scorebox">
          <div className="score" style={{ color: rate >= 80 ? '#1b7f37' : rate >= 50 ? '#e65100' : '#c62828' }}>
            {rate}%
          </div>
          <small>예상 통과율<br />(자동판정 항목 기준)</small>
        </div>
      </header>

      <div className="cols">
        {/* 왼쪽: 실제 렌더 미리보기 */}
        <section className="panel">
          <div className="panel-head">디자인 미리보기</div>
          <div className="stage">
            <div className="card" style={{ background: d.bg }}>
              <div className="hero" aria-label={d.heroAlt ? '무선 이어폰 제품 사진' : undefined}>
                🎧 {d.heroAlt ? '' : <span className="warn-dot" title="alt 없음" />}
              </div>
              <div className="title" style={{ color: d.title.fg }}>{d.title.text}</div>
              <div className="desc" style={{ color: d.desc.fg }}>{d.desc.text}</div>
              <div className="price" style={{ color: d.price.fg }}>{d.price.text}</div>
              <div className="row">
                <button className="buy" style={{ width: d.buyW, height: d.buyH }}>구매하기</button>
                <button className="fav" aria-label={d.favLabeled ? '찜하기' : undefined}>♥</button>
              </div>
            </div>
          </div>
          <div className="legend">
            <span className="stat pass">합격 {result.summary.pass}</span>
            <span className="stat fail">불합격 {result.summary.fail}</span>
            <button className="ghost" onClick={() => setD(INITIAL)}>초기화</button>
          </div>
        </section>

        {/* 오른쪽: 진단 결과 */}
        <section className="panel">
          <div className="panel-head">
            진단 결과
            <div className="head-actions">
              {fails.length > 0 && <button className="primary" onClick={applyAll}>전체 자동 보정</button>}
              <button className="ghost" onClick={downloadReport}>리포트(JSON)</button>
            </div>
          </div>

          <ul className="list">
            {fails.length === 0 && (
              <li className="done">🎉 자동 판정 항목을 모두 통과했습니다. (전체 접근성 보장은 아님 — 수동 검토 권장)</li>
            )}
            {fails.map((f) => (
              <li className="finding" key={`${f.nodeId}:${f.ruleId}`}>
                <div className="f-head">
                  <span className="badge" style={{ background: SEVERITY_COLOR[f.severity] }}>{f.severity}</span>
                  <span className="badge gray">{SOURCE_LABEL[f.source]}</span>
                  <strong>{f.nodeName}</strong>
                </div>
                <div className="crit">{f.criterion}</div>
                <div className="msg">{f.message}</div>
                {f.fix?.kind === 'color' && (
                  <div className="swatches">
                    <Swatch hex={f.fix.before.fgColor as string} label="현재" bg={d.bg} />
                    <span className="arrow">→</span>
                    <Swatch hex={f.fix.after.fgColor as string} label="보정" bg={d.bg} />
                  </div>
                )}
                <div className="f-actions">
                  <button className="primary sm" onClick={() => applyFix(f)}>수정 적용</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="foot">
        본 결과는 <strong>자동 판정 가능한 항목 기준</strong>이며 전체 접근성 준수를 보장하지 않습니다.
        보정은 항목별로 검토·수락 후 적용됩니다. · 색 보정은 색상·채도를 유지하고 명도만 조정합니다.
      </footer>
    </div>
  );
}

function Swatch({ hex, label, bg }: { hex: string; label: string; bg: string }) {
  return (
    <span className="swatch">
      <span className="chip" style={{ background: bg }}>
        <span style={{ color: hex, fontWeight: 700 }}>가</span>
      </span>
      <span className="sw-meta">
        <code>{hex}</code>
        <small>{label} · {contrastRatio(hex, bg).toFixed(2)}:1</small>
      </span>
    </span>
  );
}
