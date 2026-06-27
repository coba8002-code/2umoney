/** 브라우저용 분석 함수들: URL · 이미지 · Figma (HTML 은 ../htmlAnalyze) */
import { scanNodes, type ScanResult, type A11yNode } from '@app/core';
import { figmaFileToA11yNodes, parseFigmaFileKey } from '@app/api';
import { HeuristicAltProvider, enrichAltSuggestions } from '@app/ai';
import { analyzeHtml } from '../htmlAnalyze';

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

/** 이미지 파일 → alt 필요 검출 + 휴리스틱 alt 제안 + 메타데이터 */
export async function analyzeImage(file: File): Promise<ImageAnalysis> {
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
  const findings = await enrichAltSuggestions(base.findings, new HeuristicAltProvider(), {
    contexts: { img: { nodeId: 'img', name: file.name } },
  });
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
