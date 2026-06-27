import { useEffect, useMemo, useState } from 'react';
import { reportToJson, type ScanResult, type Finding } from '@app/core';
import type { MainToUi, UiToMain } from '../messages';

function downloadReport(result: ScanResult): void {
  const blob = new Blob([reportToJson(result)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'a11y-report.json';
  a.click();
  URL.revokeObjectURL(url);
}

function send(msg: UiToMain): void {
  parent.postMessage({ pluginMessage: msg }, '*');
}

const SEVERITY_COLOR: Record<Finding['severity'], string> = {
  critical: '#d32f2f',
  serious: '#e65100',
  moderate: '#f9a825',
  minor: '#1976d2',
};

const SOURCE_LABEL: Record<Finding['source'], string> = {
  auto: '자동',
  'ai-assisted': 'AI 보조',
  manual: '수동',
};

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="badge" style={{ background: color }}>
      {children}
    </span>
  );
}

function FindingCard({
  f,
  onHighlight,
  onApply,
  ignored,
  onIgnore,
}: {
  f: Finding;
  onHighlight: () => void;
  onApply: () => void;
  ignored: boolean;
  onIgnore: () => void;
}) {
  const fixable = !!f.fix && (f.fix.kind === 'color' || f.fix.kind === 'touchTarget' || f.fix.kind === 'fontSize');
  return (
    <li className={`card ${ignored ? 'ignored' : ''}`} aria-label={`${f.nodeName ?? f.nodeId} 항목`}>
      <div className="card-head">
        {f.status === 'pass' ? (
          <Badge color="#1b7f37">합격</Badge>
        ) : f.status === 'manual' ? (
          <Badge color="#6a4caf">수동확인</Badge>
        ) : (
          <Badge color={SEVERITY_COLOR[f.severity]}>{f.severity}</Badge>
        )}
        <Badge color="#455a64">{SOURCE_LABEL[f.source]}</Badge>
        <span className="node-name">{f.nodeName ?? f.nodeId}</span>
      </div>
      <p className="criterion">{f.criterion}</p>
      <p className="message">{f.message}</p>
      {f.fix && (
        <p className="fix">
          제안: <code>{JSON.stringify(f.fix.before)}</code> →{' '}
          <code>{JSON.stringify(f.fix.after)}</code>{' '}
          <span className="impact">(스타일 영향: {f.fix.styleImpact})</span>
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={onHighlight}>
          위치 보기
        </button>
        {fixable && !ignored && (
          <button type="button" className="primary" onClick={onApply}>
            수정 적용
          </button>
        )}
        <button type="button" onClick={onIgnore}>
          {ignored ? '무시 해제' : '무시'}
        </button>
      </div>
    </li>
  );
}

export function App() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scope, setScope] = useState<'selection' | 'page'>('selection');
  const [toast, setToast] = useState<string>('');
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'fail' | 'manual'>('fail');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as MainToUi | undefined;
      if (!msg) return;
      if (msg.type === 'scan-result') setResult(msg.result);
      else if (msg.type === 'applied') setToast(msg.message);
      else if (msg.type === 'error') setToast(msg.message);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const summary = result?.summary;
  const passRate = summary ? Math.round(summary.estimatedPassRate * 100) : 0;

  const findings = useMemo(() => {
    if (!result) return [];
    return result.findings.filter((f) => (filter === 'all' ? true : f.status === filter));
  }, [result, filter]);

  const colorFails = result?.findings.filter((f) => f.status === 'fail' && f.fix?.kind === 'color').length ?? 0;

  const key = (f: Finding) => `${f.nodeId}::${f.ruleId}`;

  return (
    <main>
      <header>
        <div className="scope">
          <button type="button" className={scope === 'selection' ? 'seg active' : 'seg'} onClick={() => setScope('selection')}>
            선택 영역
          </button>
          <button type="button" className={scope === 'page' ? 'seg active' : 'seg'} onClick={() => setScope('page')}>
            페이지 전체
          </button>
          <button type="button" className="primary" onClick={() => send({ type: 'scan', scope })}>
            진단
          </button>
        </div>

        {summary && (
          <div className="summary" role="status">
            <span className="stat pass">합격 {summary.pass}</span>
            <span className="stat fail">불합격 {summary.fail}</span>
            <span className="stat manual">수동 {summary.manual}</span>
            <span className="rate">
              예상 통과율 {passRate}%
              <small>{summary.estimatedPassRateLabel}</small>
            </span>
          </div>
        )}
      </header>

      {result && (
        <div className="toolbar">
          <div className="filters" role="tablist" aria-label="필터">
            {(['fail', 'manual', 'all'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
                {k === 'fail' ? '불합격' : k === 'manual' ? '수동' : '전체'}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            {colorFails > 0 && (
              <button type="button" onClick={() => send({ type: 'apply-all-color' })}>
                모든 색대비 자동 보정 ({colorFails})
              </button>
            )}
            <button type="button" onClick={() => result && downloadReport(result)}>
              리포트(JSON)
            </button>
          </div>
        </div>
      )}

      <ul className="list">
        {findings.length === 0 && result && <li className="empty">표시할 항목이 없습니다.</li>}
        {findings.map((f) => (
          <FindingCard
            key={key(f)}
            f={f}
            ignored={ignored.has(key(f))}
            onHighlight={() => send({ type: 'highlight', nodeId: f.nodeId })}
            onApply={() => send({ type: 'apply-fix', nodeId: f.nodeId, ruleId: f.ruleId })}
            onIgnore={() =>
              setIgnored((prev) => {
                const next = new Set(prev);
                next.has(key(f)) ? next.delete(key(f)) : next.add(key(f));
                return next;
              })
            }
          />
        ))}
      </ul>

      <footer>
        <p className="disclaimer">
          본 결과는 <strong>자동 판정 가능한 항목 기준</strong>이며, 전체 접근성 준수를 보장하지 않습니다. 보정은 항목별로 직접 검토·수락 후 적용됩니다.
        </p>
      </footer>

      {toast && (
        <div className="toast" role="alert" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}
    </main>
  );
}
