import { useState } from 'react';
import type { ScanResult, Finding } from '@app/core';

const SEVERITY_COLOR: Record<Finding['severity'], string> = {
  critical: '#d32f2f',
  serious: '#e65100',
  moderate: '#f9a825',
  minor: '#1976d2',
};
const SOURCE_LABEL: Record<Finding['source'], string> = { auto: '자동', 'ai-assisted': 'AI 보조', manual: '수동' };

export function downloadJson(result: ScanResult, name = 'a11y-report.json') {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

export function FindingsList({ result }: { result: ScanResult }) {
  const [filter, setFilter] = useState<'fail' | 'all'>('fail');
  const shown = result.findings.filter((f) => (filter === 'fail' ? f.status === 'fail' : true));
  const rate = Math.round(result.summary.estimatedPassRate * 100);

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          {(['fail', 'all'] as const).map((k) => (
            <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
              {k === 'fail' ? `불합격 ${result.summary.fail}` : '전체'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#666' }}>합격 {result.summary.pass} · 통과율 {rate}%</span>
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
              {f.confidence === 'low' && (
                <span className="badge" style={{ background: '#8d6e63' }} title={f.confidenceReason ?? ''}>확인필요</span>
              )}
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
  );
}
