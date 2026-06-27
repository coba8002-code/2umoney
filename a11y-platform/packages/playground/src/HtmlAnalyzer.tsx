import { useState } from 'react';
import type { ScanResult, Finding } from '@app/core';
import { analyzeHtml } from './htmlAnalyze';

const SEVERITY_COLOR: Record<Finding['severity'], string> = {
  critical: '#d32f2f',
  serious: '#e65100',
  moderate: '#f9a825',
  minor: '#1976d2',
};
const SOURCE_LABEL: Record<Finding['source'], string> = { auto: '자동', 'ai-assisted': 'AI 보조', manual: '수동' };

const SAMPLE_HTML = `<main style="background:#ffffff;padding:16px">
  <h1 style="color:#222;font-size:28px">상품 안내</h1>
  <h3 style="color:#222">소제목 (h2 건너뜀)</h3>
  <p style="color:#aaaaaa;font-size:14px;line-height:16px">연회색 본문 — 대비도 행간도 부족합니다.</p>
  <a href="#" style="color:#1976d2;text-decoration:none">색만 다른 링크</a>
  <img src="x" width="200" height="120" />
  <button style="color:#fff;background:#1976d2;width:30px;height:28px">확인</button>
</main>`;

export function HtmlAnalyzer() {
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<'fail' | 'all'>('fail');
  const [error, setError] = useState('');

  function run() {
    setError('');
    try {
      setResult(analyzeHtml(html));
    } catch (e) {
      setError(`분석 실패: ${(e as Error).message}`);
    }
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'a11y-html-report.json';
    a.click();
  }

  const shown = result?.findings.filter((f) => (filter === 'fail' ? f.status === 'fail' : true)) ?? [];
  const rate = result ? Math.round(result.summary.estimatedPassRate * 100) : 0;

  return (
    <div className="cols">
      <section className="panel">
        <div className="panel-head">HTML 입력</div>
        <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            aria-label="분석할 HTML"
            style={{ flex: 1, minHeight: 280, fontFamily: 'monospace', fontSize: 12, padding: 10, borderRadius: 8, border: '1px solid #ddd', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={run}>분석</button>
            <button className="ghost" onClick={() => setHtml(SAMPLE_HTML)}>샘플</button>
            {result && <button className="ghost" onClick={downloadReport}>리포트(JSON)</button>}
          </div>
          {error && <p style={{ color: '#c62828', fontSize: 12 }}>{error}</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          분석 결과
          {result && (
            <span style={{ fontWeight: 400, fontSize: 12 }}>
              합격 {result.summary.pass} · 불합격 {result.summary.fail} · 통과율 {rate}%
            </span>
          )}
        </div>
        {!result && <div className="done" style={{ color: '#888' }}>HTML 을 넣고 [분석]을 누르세요.</div>}
        {result && (
          <>
            <div className="toolbar">
              <div className="filters">
                {(['fail', 'all'] as const).map((k) => (
                  <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
                    {k === 'fail' ? '불합격' : '전체'}
                  </button>
                ))}
              </div>
            </div>
            <ul className="list">
              {shown.length === 0 && <li className="done">🎉 표시할 항목이 없습니다.</li>}
              {shown.map((f, i) => (
                <li className="finding" key={`${f.nodeId}:${f.ruleId}:${i}`}>
                  <div className="f-head">
                    {f.status === 'pass' ? (
                      <span className="badge" style={{ background: '#1b7f37' }}>합격</span>
                    ) : (
                      <span className="badge" style={{ background: SEVERITY_COLOR[f.severity] }}>{f.severity}</span>
                    )}
                    <span className="badge gray">{SOURCE_LABEL[f.source]}</span>
                    {f.confidence === 'low' && <span className="badge" style={{ background: '#8d6e63' }}>확인필요</span>}
                    <strong>{f.nodeName ?? f.nodeId}</strong>
                  </div>
                  <div className="crit">{f.criterion}</div>
                  <div className="msg">{f.message}</div>
                  {f.fix?.kind === 'color' && (
                    <div className="swatches">
                      <span className="chip" style={{ background: '#fff' }}>
                        <span style={{ color: String(f.fix.before.fgColor), fontWeight: 700 }}>가</span>
                      </span>
                      <code>{String(f.fix.before.fgColor)}</code>
                      <span className="arrow">→</span>
                      <span className="chip" style={{ background: '#fff' }}>
                        <span style={{ color: String(f.fix.after.fgColor), fontWeight: 700 }}>가</span>
                      </span>
                      <code>{String(f.fix.after.fgColor)}</code>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
