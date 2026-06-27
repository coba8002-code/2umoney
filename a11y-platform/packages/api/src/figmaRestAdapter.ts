/**
 * Figma REST API(파일 JSON) → A11yNode 정규화.
 * 플러그인 어댑터(Plugin API)와 달리 REST 응답(document 트리)을 입력으로 받는다.
 * 토큰으로 받은 파일 JSON 을 서버/브라우저 어디서든 분석할 수 있게 한다.
 */
import type { A11yNode } from '@app/core';

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}
export interface FigmaPaint {
  type: string; // 'SOLID' | 'IMAGE' | 'GRADIENT_*' ...
  color?: FigmaColor;
  opacity?: number;
  visible?: boolean;
}
export interface FigmaRestNode {
  id: string;
  name: string;
  type: string; // 'FRAME' | 'TEXT' | 'RECTANGLE' | ...
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  style?: { fontSize?: number; fontWeight?: number };
  characters?: string;
  absoluteBoundingBox?: { width: number; height: number } | null;
  opacity?: number;
  visible?: boolean;
  children?: FigmaRestNode[];
}

export function figmaColorToHex(c: FigmaColor): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function firstSolid(paints?: FigmaPaint[]): FigmaPaint | null {
  if (!paints) return null;
  for (const p of paints) {
    if (p.type === 'SOLID' && p.visible !== false && (p.opacity ?? 1) >= 0.5 && p.color) return p;
  }
  return null;
}

function hasImageFill(paints?: FigmaPaint[]): boolean {
  return !!paints?.some((p) => p.type === 'IMAGE' && p.visible !== false);
}

function inferType(node: FigmaRestNode): A11yNode['type'] {
  if (node.type === 'TEXT') return 'text';
  const name = node.name.toLowerCase();
  if (/btn|button|버튼|cta/.test(name)) return 'button';
  if (/input|field|입력|텍스트필드/.test(name)) return 'input';
  if (/icon|아이콘/.test(name)) return 'icon';
  if (/link|링크/.test(name)) return 'link';
  if (hasImageFill(node.fills)) return 'image';
  if (['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'CANVAS', 'DOCUMENT'].includes(node.type)) return 'container';
  return 'container';
}

function firstText(node: FigmaRestNode): string | undefined {
  if (node.type === 'TEXT' && node.characters?.trim()) return node.characters.trim();
  for (const c of node.children ?? []) {
    const t = firstText(c);
    if (t) return t;
  }
  return undefined;
}

function convert(node: FigmaRestNode, inheritedBg: string): A11yNode {
  const type = inferType(node);
  const ownBgPaint = firstSolid(node.fills);
  const ownBg = ownBgPaint?.color ? figmaColorToHex(ownBgPaint.color) : null;
  // 컨테이너의 SOLID fill 은 배경으로, TEXT 의 fill 은 전경으로 해석
  const effBg = type !== 'text' && ownBg ? ownBg : inheritedBg;

  const out: A11yNode = {
    id: node.id,
    type,
    name: node.name,
    bgColor: effBg,
    semanticsReliable: false, // Figma 의미정보는 휴리스틱
  };

  if (node.absoluteBoundingBox) {
    out.width = node.absoluteBoundingBox.width;
    out.height = node.absoluteBoundingBox.height;
  }

  if (node.type === 'TEXT') {
    const fg = firstSolid(node.fills);
    if (fg?.color) out.fgColor = figmaColorToHex(fg.color);
    out.fontSizePx = node.style?.fontSize;
    out.fontWeight = node.style?.fontWeight;
    out.bold = (node.style?.fontWeight ?? 400) >= 600;
  } else {
    const stroke = firstSolid(node.strokes);
    if (ownBg) out.fgColor = ownBg;
    else if (stroke?.color) out.fgColor = figmaColorToHex(stroke.color);
  }

  if (type === 'image') {
    out.altText = null; // REST 에 alt 없음 → 검출되도록
    out.decorative = /deco|장식|bg|배경/i.test(node.name);
  }
  if (type === 'button' || type === 'input' || type === 'link') {
    out.focusable = true;
    out.hasVisibleFocusStyle = /focus|포커스/i.test(node.name);
    out.label = firstText(node) ?? null;
  }

  if (node.children && node.children.length > 0) {
    out.children = node.children
      .filter((c) => c.visible !== false)
      .map((c) => convert(c, effBg));
  }
  return out;
}

/** Figma REST 파일 응답(document) → A11yNode 루트 배열 */
export function figmaFileToA11yNodes(document: FigmaRestNode, pageBg = '#ffffff'): A11yNode[] {
  // DOCUMENT → CANVAS(페이지)들. 각 최상위 자식을 루트로.
  const roots = document.children ?? [document];
  return roots.map((r) => convert(r, pageBg));
}

/** figma.com 파일 URL 에서 fileKey 추출 */
export function parseFigmaFileKey(url: string): string | null {
  const m = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}
