/** 브라우저용 분석 함수들: URL · 이미지 · Figma (HTML 은 ../htmlAnalyze) */
import { scanNodes, type ScanResult, type A11yNode } from '@app/core';
import { figmaFileToA11yNodes, parseFigmaFileKey } from '@app/api';
import {
  HeuristicAltProvider,
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

/** URL → 정적 HTML 가져와 분석 (CORS 프록시 경유; 외부 CSS/JS 미적용) */
export async function analyzeUrl(url: string, proxy = 'https://api.allorigins.win/raw?url='): Promise<ScanResult> {
  const target = /^https?:\/\//.test(url) ? url : `https://${url}`;
  const res = await fetch(proxy + encodeURIComponent(target));
  if (!res.ok) throw new Error(`가져오기 실패: HTTP ${res.status}`);
  const html = await res.text();
  return analyzeHtml(html);
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
   * 대체텍스트를 생성한다. 미지정 시 네트워크 없는 휴리스틱 초안만 제안.
   */
  altEndpoint?: string;
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

  const endpoint = opts.altEndpoint?.trim();
  const provider: LlmProvider = endpoint ? new RemoteAltProvider(endpoint) : new HeuristicAltProvider();
  // 비전 LLM 사용 시에만 이미지 데이터를 전송(서버가 실제 내용을 보도록)
  const context: ImageContext = endpoint
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
