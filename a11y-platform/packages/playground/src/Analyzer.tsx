import { useState } from 'react';
import type { ScanResult } from '@app/core';
import { analyzeHtml } from './htmlAnalyze';
import type { KioskReport } from '@app/api';
import { analyzeUrl, analyzeSite, analyzeImage, analyzeFigma, analyzeUnity, analyzeKiosk } from './analysis/analyzers';
import { FindingsList, downloadJson } from './analysis/FindingsList';
import { KioskReportView } from './analysis/KioskReportView';

type Mode = 'html' | 'url' | 'image' | 'figma' | 'unity' | 'kiosk';

const SAMPLE_HTML = `<main style="background:#fff;padding:16px">
  <h1 style="color:#222;font-size:28px">상품 안내</h1>
  <h3 style="color:#222">소제목 (h2 건너뜀)</h3>
  <p style="color:#aaa;font-size:14px;line-height:16px">연회색 본문 — 대비도 행간도 부족.</p>
  <a href="#" style="color:#1976d2;text-decoration:none">색만 다른 링크</a>
  <img src="x" width="200" height="120" />
  <button style="color:#fff;background:#1976d2;width:30px;height:28px">확인</button>
</main>`;

const MODES: { key: Mode; label: string }[] = [
  { key: 'html', label: 'HTML' },
  { key: 'url', label: 'URL' },
  { key: 'image', label: '이미지' },
  { key: 'figma', label: 'Figma' },
  { key: 'unity', label: 'Unity' },
  { key: 'kiosk', label: '키오스크 진단' },
];

const SAMPLE_KIOSK = `{
  "screenSpec": { "diagonalInch": 15.6, "widthPx": 1920, "heightPx": 1080 },
  "elements": [
    { "id": "title", "kind": "text", "boxPx": { "x": 40, "y": 40, "widthPx": 320, "heightPx": 44 },
      "charHeightPx": 30, "text": "주문하기", "fgColor": "#999999", "bgColor": "#ffffff" },
    { "id": "menu1", "kind": "button", "boxPx": { "x": 40, "y": 120, "widthPx": 90, "heightPx": 90 },
      "label": "아메리카노", "fgColor": "#ffffff", "bgColor": "#1565c0" },
    { "id": "pay", "kind": "button", "boxPx": { "x": 40, "y": 240, "widthPx": 40, "heightPx": 40 },
      "fgColor": "#ffffff", "bgColor": "#1976d2" },
    { "id": "logo", "kind": "image", "boxPx": { "x": 400, "y": 40, "widthPx": 120, "heightPx": 40 } }
  ]
}`;

const SAMPLE_UNITY = `{
  "screenBg": "#ffffff",
  "root": {
    "id": "canvas", "kind": "Canvas", "backgroundColor": "#ffffff",
    "children": [
      { "id": "title", "kind": "TMP_Text", "text": "주문하기", "color": "#aaaaaa", "fontSizePx": 18 },
      { "id": "pay", "kind": "Button", "backgroundColor": "#1976d2",
        "rect": { "width": 30, "height": 28 },
        "children": [{ "id": "lbl", "kind": "Text", "text": "결제", "color": "#ffffff", "fontSizePx": 16 }] },
      { "id": "logo", "kind": "Image", "rect": { "width": 120, "height": 40 } }
    ]
  }
}`;

export function Analyzer() {
  const [mode, setMode] = useState<Mode>('html');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imgPreview, setImgPreview] = useState('');

  // 입력값
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [url, setUrl] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [altEndpoint, setAltEndpoint] = useState('');
  const [altApiKey, setAltApiKey] = useState('');
  const [serverBase, setServerBase] = useState('');
  const [crawl, setCrawl] = useState(false);
  const [maxPages, setMaxPages] = useState(5);
  const [unityJson, setUnityJson] = useState(SAMPLE_UNITY);
  const [kioskJson, setKioskJson] = useState(SAMPLE_KIOSK);
  const [kioskReport, setKioskReport] = useState<KioskReport | null>(null);

  function reset() {
    setResult(null);
    setError('');
    setImgPreview('');
    setKioskReport(null);
  }

  function runKiosk() {
    setBusy(true);
    setError('');
    setKioskReport(null);
    try {
      setKioskReport(analyzeKiosk(kioskJson));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<ScanResult> | ScanResult) {
    setBusy(true);
    setError('');
    try {
      setResult(await fn());
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onImage(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const a = await analyzeImage(file, { altEndpoint, apiKey: altApiKey });
      setImgPreview(a.previewUrl);
      setResult(a.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="toolbar" style={{ borderTop: 'none' }}>
        <div className="seg">
          {MODES.map((m) => (
            <button key={m.key} className={mode === m.key ? 'on' : ''} onClick={() => { setMode(m.key); reset(); }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">입력</div>
          <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mode === 'html' && (
              <>
                <textarea value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} aria-label="분석할 HTML"
                  style={{ flex: 1, minHeight: 260, fontFamily: 'monospace', fontSize: 12, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary" disabled={busy} onClick={() => run(() => analyzeHtml(html))}>분석</button>
                  <button className="ghost" onClick={() => setHtml(SAMPLE_HTML)}>샘플</button>
                </div>
              </>
            )}

            {mode === 'url' && (
              <>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com"
                  aria-label="분석할 URL" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                <input value={serverBase} onChange={(e) => setServerBase(e.target.value)} placeholder="분석 서버(선택, 권장): https://host"
                  aria-label="분석 서버 주소" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={crawl} disabled={!serverBase.trim()} onChange={(e) => setCrawl(e.target.checked)} />
                  하위 링크(동일 출처) 크롤링 — 최대
                  <input type="number" min={1} max={25} value={maxPages} disabled={!serverBase.trim() || !crawl}
                    onChange={(e) => setMaxPages(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                    style={{ width: 56, padding: '2px 6px', borderRadius: 6, border: '1px solid #ddd' }} /> 페이지
                </label>
                <button className="primary" disabled={busy || !url}
                  onClick={() =>
                    run(() =>
                      serverBase.trim()
                        ? crawl
                          ? analyzeSite(url, { serverBase, maxPages })
                          : analyzeUrl(url) // 서버만 있고 크롤 미선택 시 단일 페이지(프록시)
                        : analyzeUrl(url),
                    )
                  }>
                  {busy ? '가져오는 중…' : crawl && serverBase.trim() ? '크롤링 분석' : '가져와서 분석'}
                </button>
                <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  · <strong>분석 서버 미입력</strong>: 공개 CORS 프록시로 <strong>한 페이지의 정적 HTML</strong>만
                  가져옵니다(여러 프록시 자동 폴백). 외부 CSS·JS 렌더 결과는 반영되지 않아 일부 색/레이아웃 판정이
                  실제와 다를 수 있고, 프록시 사정으로 실패할 수 있습니다.
                  <br />· <strong>분석 서버 입력(권장)</strong>: 서버측 Playwright 가 실제 렌더링해 정확히 수집하며,
                  <strong>크롤링</strong>을 켜면 동일 출처 하위 페이지까지 한 번에 분석합니다(외부·다른 출처 링크 제외).
                  <br />서버는 <code>@app/api</code> 를 <code>pnpm --filter @app/api serve</code> 또는 Docker 로 띄우면 됩니다.
                </p>
              </>
            )}

            {mode === 'image' && (
              <>
                <input type="file" accept="image/*" aria-label="이미지 업로드" onChange={(e) => onImage(e.target.files?.[0])} />
                {imgPreview && <img src={imgPreview} alt="업로드 미리보기" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid #eee' }} />}
                <input value={altEndpoint} onChange={(e) => setAltEndpoint(e.target.value)} placeholder="① 비전 LLM 서버(권장): https://host/v1/alt"
                  aria-label="대체텍스트 비전 LLM 서버 주소" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                <input value={altApiKey} onChange={(e) => setAltApiKey(e.target.value)} type="password" placeholder="② Anthropic API 키(서버 없이 바로 시험)"
                  autoComplete="off" aria-label="Anthropic API 키" disabled={!!altEndpoint.trim()}
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13, opacity: altEndpoint.trim() ? 0.5 : 1 }} />
                <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  이미지의 <strong>대체텍스트 필요 여부</strong>를 검출하고 alt 초안을 제안합니다.
                  비전 LLM(C2)으로 이미지 <strong>내용</strong>을 보고 alt 를 생성하려면 둘 중 하나를 입력하세요:
                  <br />· <strong>①서버 주소</strong> — API 키를 서버가 보관(권장, 키 비노출).
                  <br />· <strong>②API 키</strong> — 서버 없이 브라우저에서 Anthropic 으로 직접 호출. 키는
                  <strong> 브라우저에서만</strong> 쓰이고 어디에도 저장·전송되지 않지만, 클라이언트에 노출되므로
                  본인 키로 잠깐 시험할 때만 쓰세요.
                  <br />둘 다 비우면 네트워크 없는 휴리스틱 초안. 모든 AI 제안은 <strong>ai-assisted</strong> 로
                  표시되고 사람 수락 후 적용됩니다.
                </p>
              </>
            )}

            {mode === 'figma' && (
              <>
                <input value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/design/KEY/..."
                  aria-label="Figma 파일 URL" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                <input value={figmaToken} onChange={(e) => setFigmaToken(e.target.value)} type="password" placeholder="Figma 개인 액세스 토큰"
                  aria-label="Figma 토큰" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                <button className="primary" disabled={busy || !figmaUrl || !figmaToken} onClick={() => run(() => analyzeFigma(figmaUrl, figmaToken))}>
                  {busy ? '불러오는 중…' : 'Figma 분석'}
                </button>
                <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  Figma REST API 로 파일을 불러와 분석합니다. 토큰은 브라우저에서만 사용되고 전송·저장되지 않습니다.
                  (Settings → Account → Personal access tokens 에서 발급)
                </p>
              </>
            )}

            {mode === 'unity' && (
              <>
                <textarea value={unityJson} onChange={(e) => setUnityJson(e.target.value)} spellCheck={false} aria-label="Unity export JSON"
                  style={{ flex: 1, minHeight: 260, fontFamily: 'monospace', fontSize: 12, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary" disabled={busy} onClick={() => run(() => analyzeUnity(unityJson))}>분석</button>
                  <button className="ghost" onClick={() => setUnityJson(SAMPLE_UNITY)}>샘플</button>
                </div>
                <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  Unity 키오스크는 화면을 픽셀로 그려 구조 정보가 없으므로, Unity 측에서 UI 계층을
                  <code>{' { root|nodes, screenBg } '}</code> JSON 으로 export 해 붙여넣습니다. 각 노드의
                  <strong> 실제 좌표·색·폰트</strong>로 명도대비·터치 타깃 크기·대체텍스트를 정확히 검사합니다.
                  (export 가 어려우면 <strong>이미지</strong> 탭의 비전 LLM 으로 화면 캡처를 분석하세요.)
                </p>
              </>
            )}

            {mode === 'kiosk' && (
              <>
                <textarea value={kioskJson} onChange={(e) => setKioskJson(e.target.value)} spellCheck={false} aria-label="키오스크 화면 모델 JSON"
                  style={{ flex: 1, minHeight: 260, fontFamily: 'monospace', fontSize: 12, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary" disabled={busy} onClick={runKiosk}>진단</button>
                  <button className="ghost" onClick={() => setKioskJson(SAMPLE_KIOSK)}>샘플</button>
                </div>
                <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                  무인정보단말기(키오스크) 접근성 진단(별표5 / KS X 9211:2025). 현장 화면에서 검출한
                  <strong> 요소(버튼·텍스트 좌표·색)</strong>와 <strong>보정</strong>(화면 대각인치+해상도 또는 기준 마커)을 넣으면,
                  명도대비·버튼 크기(MBR 12mm/144mm²)·문자높이(7.25mm)·레이블을 판정해 <strong>우선순위·수선분류
                  (S/W·H/W·운영)</strong> 리포트를 만듭니다. 서버 없이 브라우저에서 바로 실행됩니다.
                  <br />※ <code>screenSpec</code>(또는 <code>calibration</code>) 없이 크기 항목은 "실측필요"로 분류됩니다.
                  이미지→요소 자동 검출(Vision)은 다음 단계입니다.
                </p>
              </>
            )}

            {error && <p style={{ color: '#c62828', fontSize: 12 }}>분석 실패: {error}</p>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            {mode === 'kiosk' ? '키오스크 진단 리포트' : '분석 결과'}
            {result && mode !== 'kiosk' && <button className="ghost" onClick={() => downloadJson(result)}>리포트(JSON)</button>}
          </div>
          {mode === 'kiosk' ? (
            <>
              {!kioskReport && !busy && <div className="done" style={{ color: '#888' }}>화면 모델 입력 후 진단을 실행하세요.</div>}
              {busy && <div className="done" style={{ color: '#888' }}>진단 중…</div>}
              {kioskReport && <KioskReportView report={kioskReport} />}
            </>
          ) : (
            <>
              {!result && !busy && <div className="done" style={{ color: '#888' }}>입력 후 분석을 실행하세요.</div>}
              {busy && <div className="done" style={{ color: '#888' }}>분석 중…</div>}
              {result && <FindingsList result={result} />}
            </>
          )}
        </section>
      </div>
    </>
  );
}
