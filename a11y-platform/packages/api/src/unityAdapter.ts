/**
 * Unity UI 계층(export JSON) → A11yNode 정규화.
 *
 * Unity 키오스크는 모든 것을 하나의 캔버스에 픽셀로 그리므로 DOM/시맨틱 트리가 없다.
 * 따라서 정확한 분석을 위해 Unity 측에서 UI 요소(Canvas 하위 RectTransform)를 순회해
 * 아래 형태의 JSON 으로 export 하면, HTML/Figma 와 동일한 결정론 룰셋으로 검사할 수 있다.
 * (좌표·색·폰트는 실제 컴포넌트 값이라 신뢰 가능 — 비전 추정보다 정확)
 *
 * 색은 hex 문자열('#RRGGBB') 또는 Unity Color(0~1 float RGBA) 둘 다 허용한다.
 */
import type { A11yNode } from '@app/core';

export interface UnityColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}
export type UnityColorInput = string | UnityColor;

export interface UnityNode {
  id: string;
  name?: string;
  /** Unity 컴포넌트 종류: 'Text'|'TMP_Text'|'Button'|'Image'|'RawImage'|'Toggle'|'InputField'|'Panel'|'Canvas' 등 */
  kind: string;
  text?: string;
  /** 전경(텍스트) 색 */
  color?: UnityColorInput;
  /** 배경 색(Image/Panel 의 fill 등) */
  backgroundColor?: UnityColorInput;
  fontSizePx?: number;
  fontStyle?: string; // 'Bold','BoldAndItalic' 등
  /** 화면 픽셀 기준 크기(터치 타깃 판정용). Unity RectTransform 의 실제 렌더 크기 */
  rect?: { width: number; height: number };
  /** 접근성 라벨(개발자가 지정). 이미지/컨트롤의 대체텍스트 */
  accessibilityLabel?: string | null;
  altText?: string | null;
  decorative?: boolean;
  /** 상호작용 가능(Button/Toggle/InputField 등). 미지정 시 kind 로 추론 */
  interactable?: boolean;
  /** 포커스 시 시각적 표시(하이라이트/아웃라인)를 제공하는지 */
  hasFocusVisual?: boolean;
  children?: UnityNode[];
}

const TEXT_KINDS = /(^|_)(text|tmp_text|tmpro|label)$/i;
const IMAGE_KINDS = /(^|_)(image|rawimage|sprite)$/i;
const BUTTON_KINDS = /button|toggle/i;
const INPUT_KINDS = /input|field/i;
const CONTAINER_KINDS = /panel|canvas|group|container|layout|scroll/i;

export function unityColorToHex(c: UnityColorInput): string | undefined {
  if (typeof c === 'string') {
    const s = c.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.startsWith('#') ? s.toLowerCase() : `#${s.toLowerCase()}`;
    if (/^#?[0-9a-fA-F]{8}$/.test(s)) {
      const hex = s.replace('#', '');
      return `#${hex.slice(0, 6).toLowerCase()}`; // 알파 무시
    }
    return undefined;
  }
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function inferType(node: UnityNode): A11yNode['type'] {
  const k = node.kind || '';
  if (TEXT_KINDS.test(k)) return 'text';
  if (INPUT_KINDS.test(k)) return 'input';
  if (BUTTON_KINDS.test(k)) return 'button';
  if (IMAGE_KINDS.test(k)) return 'image';
  if (CONTAINER_KINDS.test(k)) return 'container';
  // 이름 힌트 보조
  const name = (node.name ?? '').toLowerCase();
  if (/btn|button|버튼/.test(name)) return 'button';
  if (/icon|아이콘/.test(name)) return 'icon';
  return 'container';
}

function isInteractive(type: A11yNode['type'], node: UnityNode): boolean {
  if (node.interactable === true) return true;
  if (node.interactable === false) return false;
  return type === 'button' || type === 'input';
}

function firstText(node: UnityNode): string | undefined {
  if (node.text?.trim()) return node.text.trim();
  for (const c of node.children ?? []) {
    const t = firstText(c);
    if (t) return t;
  }
  return undefined;
}

function convert(node: UnityNode, inheritedBg: string): A11yNode {
  const type = inferType(node);
  const ownBg = node.backgroundColor ? unityColorToHex(node.backgroundColor) : undefined;
  const effBg = type !== 'text' && ownBg ? ownBg : inheritedBg;

  const out: A11yNode = {
    id: node.id,
    type,
    name: node.name ?? node.id,
    bgColor: effBg,
    // Unity export 는 실제 컴포넌트 값(좌표·색·폰트) → 신뢰 가능
    semanticsReliable: true,
  };

  if (node.rect) {
    out.width = node.rect.width;
    out.height = node.rect.height;
  }

  if (type === 'text') {
    const fg = node.color ? unityColorToHex(node.color) : undefined;
    if (fg) out.fgColor = fg;
    out.fontSizePx = node.fontSizePx;
    out.bold = /bold/i.test(node.fontStyle ?? '');
  } else if (ownBg) {
    out.fgColor = ownBg;
  }

  if (type === 'image') {
    const alt = node.accessibilityLabel ?? node.altText;
    out.altText = alt === undefined ? null : alt; // 라벨 없으면 null → img.alt 검출
    out.decorative = node.decorative ?? /deco|장식|bg|배경/i.test(node.name ?? '');
  }

  if (isInteractive(type, node)) {
    out.focusable = true;
    out.hasVisibleFocusStyle = node.hasFocusVisual ?? false;
    out.label = node.accessibilityLabel ?? firstText(node) ?? null;
  }

  if (node.children && node.children.length > 0) {
    out.children = node.children.map((c) => convert(c, effBg));
  }
  return out;
}

export interface UnityExport {
  /** 루트(Canvas) 또는 루트 배열 */
  root?: UnityNode | UnityNode[];
  nodes?: UnityNode[];
  /** 화면 배경색(미지정 시 흰색 가정) */
  screenBg?: string;
}

/** Unity export JSON → A11yNode 루트 배열 */
export function unityExportToA11yNodes(input: UnityExport | UnityNode | UnityNode[]): A11yNode[] {
  let roots: UnityNode[];
  let bg = '#ffffff';
  if (Array.isArray(input)) {
    roots = input;
  } else if ('kind' in input) {
    roots = [input];
  } else {
    const r = input.root ?? input.nodes ?? [];
    roots = Array.isArray(r) ? r : [r];
    if (input.screenBg) bg = unityColorToHex(input.screenBg) ?? bg;
  }
  return roots.map((r) => convert(r, bg));
}
