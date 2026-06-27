/** 브라우저용 분석 함수들: URL · 이미지 · Figma (HTML 은 ../htmlAnalyze) */
import { scanNodes, type ScanResult, type A11yNode } from '@app/core';
import { figmaFileToA11yNodes, parseFigmaFileKey } from '@app/api';
import {
  HeuristicAltProvider,
  ClaudeAltProvider,
  enrichAltSuggestions,
  type LlmProvider,
  type ImageContext,
  type AltSuggestion,
} from '@app/ai';
import { analyzeHtml } from '../htmlAnalyze';

/** 파일을 base64 data URL 로 읽기 (비전 LLM 입력용) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    r.readAsDataURL(file);
  });
}

/**
 * C2: API 서버(/v1/alt)를 통해 멀티모달 Claude 로 대체텍스트를 받는 프로바이더.
 * API 키는 서버가 보관하므로 브라우저엔 노출되지 않는다. 서버 미설정 시 사용하지 않는다.
 */
class RemoteAltProvider implements LlmProvider {
  constructor(private readonly endpoint: string) {}
  async suggestAltText(img: ImageContext): Promise<AltSuggestion> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(img),
    });
    if (!res.ok) throw new Error(`alt 서버 오류: HTTP ${res.status}`);
    const json = (await res.json()) as { data?: AltSuggestion };
    if (!json.data) throw new Error('alt 서버 응답이 비어 있습니다.');
    return json.data;
  }
  async assessContextual(): Promise<{ verdict: 'unsure'; rationale: string; confidence: number }> {
    return { verdict: 'unsure', rationale: '서버 평가 미구현', confidence: 0.2 };
  }
}

/**
 * 공개 CORS 프록시 목록(순서대로 폴백). 단일 프록시 의존이 '가져오기 실패'의 주원인이라
 * 여러 곳을 차례로 시도한다. {U}=인코딩된 URL. raw HTML 을 반환하는 프록시만 사용.
 */
export const DEFAULT_URL_PROXIES = [
  'https://api.allorigins.win/raw?url={U}',
  'https://corsproxy.io/?url={U}',
  'https://thingproxy.freeboard.io/fetch/{RAW}',
];

export interface UrlFetchOptions {
  /** 프록시 템플릿 목록(순서대로 폴백). 미지정 시 DEFAULT_URL_PROXIES */
  proxies?: string[];
  /** 테스트 주입용 fetch */
  fetchImpl?: typeof fetch;
}

export function normalizeUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

/** 프록시들을 차례로 시도해 대상 URL 의 HTML 을 가져온다. 모두 실패하면 사유를 모아 throw. */
export async function fetchViaProxy(url: string, opts: UrlFetchOptions = {}): Promise<string> {
  const target = normalizeUrl(url);
  const enc = encodeURIComponent(target);
  const f = opts.fetchImpl ?? fetch;
  const proxies = opts.proxies ?? DEFAULT_URL_PROXIES;
  const errors: string[] = [];
  for (const tpl of proxies) {
    const proxyUrl = tpl.replace('{U}', enc).replace('{RAW}', target);
    const host = (() => {
      try {
        return new URL(proxyUrl).host;
      } catch {
        return tpl;
      }
    })();
    try {
      const res = await f(proxyUrl);
      if (!res.ok) {
        errors.push(`${host}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      if (!html || html.trim().length === 0) {
        errors.push(`${host}: 빈 응답`);
        continue;
      }
      return html;
    } catch (e) {
      // 네트워크/CORS 오류는 fetch 가 throw → 다음 프록시로
      errors.push(`${host}: ${(e as Error).message || '네트워크 오류'}`);
    }
  }
  throw new Error(
    `URL 을 가져오지 못했습니다(${proxies.length}개 프록시 모두 실패). ` +
      `공개 CORS 프록시는 불안정하거나 대상 사이트가 차단할 수 있습니다. ` +
      `정확·안정적 분석은 서버측 수집(API 서버의 /v1/scan, /v1/crawl)을 사용하세요. ` +
      `[상세: ${errors.join(' / ')}]`,
  );
}

/** URL → 정적 HTML 가져와 분석 (CORS 프록시 경유; 외부 CSS/JS 미적용) */
export async function analyzeUrl(url: string, opts: UrlFetchOptions = {}): Promise<ScanResult> {
  const html = await fetchViaProxy(url, opts);
  return analyzeHtml(html);
}

export interface CrawlOptions {
  /** 분석 서버 기준 주소(예: https://host) 또는 전체 엔드포인트(/v1/crawl 포함). */
  serverBase: string;
  maxPages?: number;
  sameOrigin?: boolean;
}

type CrawlPageResult = { url: string; result: ScanResult };

function shortPath(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    return u.pathname + u.search || '/';
  } catch {
    return pageUrl;
  }
}

/**
 * 서버측 크롤러(/v1/crawl)로 진입 URL 의 하위 페이지까지 수집·분석하고,
 * 모든 페이지의 findings 를 한 ScanResult 로 합쳐 반환한다(각 항목명에 페이지 경로 표기).
 * 브라우저 CORS·프록시 제약이 없어 가장 정확하다.
 */
export async function analyzeSite(url: string, opts: CrawlOptions): Promise<ScanResult> {
  const base = opts.serverBase.trim().replace(/\/$/, '');
  const endpoint = /\/v1\/crawl$/.test(base) ? base : `${base}/v1/crawl`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: normalizeUrl(url),
      options: { maxPages: opts.maxPages ?? 5, sameOrigin: opts.sameOrigin ?? true },
    }),
  });
  if (!res.ok) throw new Error(`크롤 서버 오류: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { pages?: CrawlPageResult[] } };
  const pages = json.data?.pages ?? [];
  if (pages.length === 0) throw new Error('수집된 페이지가 없습니다. URL·서버 설정을 확인하세요.');

  const findings = pages.flatMap((p) =>
    p.result.findings.map((f) => ({ ...f, nodeName: `[${shortPath(p.url)}] ${f.nodeName ?? f.nodeId}` })),
  );
  const pass = findings.filter((f) => f.status === 'pass').length;
  const fail = findings.filter((f) => f.status === 'fail').length;
  const manual = findings.filter((f) => f.status === 'manual').length;
  const auto = pass + fail;
  return {
    findings,
    summary: {
      pass,
      fail,
      manual,
      total: findings.length,
      estimatedPassRate: auto > 0 ? pass / auto : 1,
      estimatedPassRateLabel: `자동판정 가능 항목 기준 (${pages.length}개 페이지)`,
    },
  };
}

export interface ImageAnalysis {
  result: ScanResult;
  previewUrl: string;
  width: number;
  height: number;
}

export interface ImageAnalyzeOptions {
  /**
   * C2: API 서버의 /v1/alt 엔드포인트. 지정 시 이미지 내용을 실제로 보고(비전 LLM)
   * 대체텍스트를 생성한다(서버가 키 보관 — 권장).
   */
  altEndpoint?: string;
  /**
   * 서버 없이 브라우저에서 바로 비전 LLM 을 쓰기 위한 Anthropic API 키.
   * altEndpoint 가 없을 때만 사용. 키는 브라우저에서만 쓰이고 어디에도 저장/전송되지 않는다.
   */
  apiKey?: string;
}

/** 우선순위: 서버 엔드포인트 > 브라우저 직접 키 > 휴리스틱(네트워크 없음) */
function pickAltProvider(opts: ImageAnalyzeOptions): { provider: LlmProvider; usesVision: boolean } {
  const endpoint = opts.altEndpoint?.trim();
  if (endpoint) return { provider: new RemoteAltProvider(endpoint), usesVision: true };
  const key = opts.apiKey?.trim();
  if (key) return { provider: new ClaudeAltProvider({ apiKey: key, dangerouslyAllowBrowser: true }), usesVision: true };
  return { provider: new HeuristicAltProvider(), usesVision: false };
}

/** 이미지 파일 → alt 필요 검출 + alt 제안(휴리스틱 또는 비전 LLM) + 메타데이터 */
export async function analyzeImage(file: File, opts: ImageAnalyzeOptions = {}): Promise<ImageAnalysis> {
  const previewUrl = URL.createObjectURL(file);
  const dim = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    img.src = previewUrl;
  });
  const node: A11yNode = {
    id: 'img',
    type: 'image',
    name: file.name,
    altText: null,
    width: dim.w,
    height: dim.h,
    semanticsReliable: true,
  };
  const base = scanNodes([node]);

  const { provider, usesVision } = pickAltProvider(opts);
  // 비전 LLM 사용 시에만 이미지 데이터를 함께 전달(실제 내용을 보도록)
  const context: ImageContext = usesVision
    ? { nodeId: 'img', name: file.name, dataUrl: await fileToDataUrl(file) }
    : { nodeId: 'img', name: file.name };
  const findings = await enrichAltSuggestions(base.findings, provider, { contexts: { img: context } });

  return { result: { findings, summary: base.summary }, previewUrl, width: dim.w, height: dim.h };
}

/** Figma 파일 URL + 토큰 → REST API 로 파일 받아 분석 */
export async function analyzeFigma(fileUrl: string, token: string): Promise<ScanResult> {
  const key = parseFigmaFileKey(fileUrl);
  if (!key) throw new Error('유효한 Figma 파일 URL 이 아닙니다.');
  const res = await fetch(`https://api.figma.com/v1/files/${key}`, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    if (res.status === 403) throw new Error('토큰이 유효하지 않거나 파일 접근 권한이 없습니다(403).');
    throw new Error(`Figma API 오류: HTTP ${res.status}`);
  }
  const json = (await res.json()) as { document: import('@app/api').FigmaRestNode };
  const nodes = figmaFileToA11yNodes(json.document);
  return scanNodes(nodes);
}
