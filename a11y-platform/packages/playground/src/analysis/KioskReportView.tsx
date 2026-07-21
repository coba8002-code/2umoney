import type { KioskReport, KioskFinding } from '@app/api';

const STATUS_COLOR: Record<KioskFinding['status'], string> = {
  적합: '#1b7f37',
  부적합: '#d32f2f',
  실측필요: '#8d6e63',
  판정불가: '#9e9e9e',
};
const IMPORTANCE_COLOR: Record<KioskFinding['importance'], string> = {
  critical: '#d32f2f',
  high: '#e65100',
  medium: '#f9a825',
};
const REMEDY_COLOR: Record<KioskFinding['remedy'], string> = {
  'S/W': '#1976d2',
  'H/W': '#6a1b9a',
  운영: '#00838f',
};

export function downloadKioskJson(report: KioskReport, name = 'kiosk-report.json') {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ background: color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>
      {text}
    </span>
  );
}

function FindingCard({ f }: { f: KioskFinding }) {
  return (
    <li className="finding" style={{ borderLeft: `4px solid ${STATUS_COLOR[f.status]}` }}>
      <div className="f-head" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Badge text={f.status} color={STATUS_COLOR[f.status]} />
        {f.status === '부적합' && <Badge text={f.importance} color={IMPORTANCE_COLOR[f.importance]} />}
        <Badge text={f.remedy} color={REMEDY_COLOR[f.remedy]} />
        <strong>{f.criterionTitle}</strong>
        {f.elementId && <code style={{ fontSize: 11, color: '#888' }}>#{f.elementId}</code>}
      </div>
      <div className="crit" style={{ fontSize: 11, color: '#888' }}>{f.clause.join(' · ')}</div>
      <div className="msg">{f.detail}</div>
      {f.userTypes.length > 0 && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>영향: {f.userTypes.join(', ')}</div>
      )}
    </li>
  );
}

export function KioskReportView({ report }: { report: KioskReport }) {
  const s = report.summary;
  const rate = Math.round(s.passRateAuto * 100);
  const tile = (label: string, val: number, color: string) => (
    <div style={{ flex: 1, textAlign: 'center', padding: 8, borderRadius: 8, background: '#f7f7f9' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
    </div>
  );

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          자동판정 통과율 {rate}% <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>({s.passRateLabel})</span>
        </span>
        <button className="ghost" onClick={() => downloadKioskJson(report)}>리포트(JSON)</button>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '4px 12px' }}>
        {tile('적합', s.적합, '#1b7f37')}
        {tile('부적합', s.부적합, '#d32f2f')}
        {tile('실측필요', s.실측필요, '#8d6e63')}
        {tile('판정불가', s.판정불가, '#9e9e9e')}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '4px 12px', fontSize: 12, color: '#555' }}>
        수선 분류:
        <Badge text={`S/W ${report.remedyBreakdown['S/W']}`} color={REMEDY_COLOR['S/W']} />
        <Badge text={`H/W ${report.remedyBreakdown['H/W']}`} color={REMEDY_COLOR['H/W']} />
        <Badge text={`운영 ${report.remedyBreakdown['운영']}`} color={REMEDY_COLOR['운영']} />
      </div>

      {report.priorities.length > 0 && (
        <>
          <div className="panel-head" style={{ borderTop: '1px solid #eee' }}>개선 우선순위 ({report.priorities.length})</div>
          <ul className="list">
            {report.priorities.map((f, i) => (
              <FindingCard key={`p${i}`} f={f} />
            ))}
          </ul>
        </>
      )}

      <div className="panel-head" style={{ borderTop: '1px solid #eee' }}>전체 판정 ({report.findings.length})</div>
      <ul className="list">
        {report.findings.map((f, i) => (
          <FindingCard key={`f${i}`} f={f} />
        ))}
      </ul>

      <p style={{ fontSize: 11, color: '#8d6e63', padding: '8px 12px', lineHeight: 1.5 }}>⚠️ {report.guardrail}</p>
    </>
  );
}
