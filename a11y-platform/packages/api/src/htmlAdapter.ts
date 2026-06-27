/**
 * D: HTML DOM 스냅샷 → A11yNode 정규화.
 * 브라우저(Playwright)가 직렬화한 스냅샷을 입력으로 받아, 코어 룰셋이 쓰는
 * 공통 모델로 변환한다. (브라우저 없이도 단위 테스트 가능하도록 순수 함수)
 */
import type { A11yNode } from '@app/core';

/** 브라우저에서 직렬화한 단일 요소 스냅샷 */
export interface DomElementSnapshot {
  id: string;
  tag: string; // 소문자 태그명 (a, button, img, h1, p, div ...)
  role?: string;
  text?: string;
  attrs?: {
    alt?: string | null;
    'aria-label'?: string;
    'aria-labelledby-text'?: string;
    'aria-hidden'?: string;
    href?: string;
    tabindex?: string;
    title?: string;
  };
  style?: {
    color?: string; // 'rgb(...)' | 'rgba(...)' | '#hex'
    backgroundColor?: string;
    fontSizePx?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacingPx?: number;
    textDecorationLine?: string; // 'underline' | 'none' ...
    focusVisible?: boolean; // :focus 시 가시적 아웃라인 존재 여부(콜렉터 측정)
  };
  rect?: { width: number; height: number };
  children?: DomElementSnapshot[];
}

export interface DomSnapshot {
  root: DomElementSnapshot;
}

const HEADING = /^h([1-6])$/;
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea']);

/** 'rgb(r,g,b)' / 'rgba(r,g,b,a)' / '#hex' → hex | null(투명) */
export function cssColorToHex(c?: string): string | null {
  if (!c) return null;
  const s = c.trim().toLowerCase();
  if (s === 'transparent') return null;
  if (s.startsWith('#')) return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s.slice(0, 7);
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
  const [r, g, b, a = 1] = parts;
  if (a < 0.1) return null; // 사실상 투명 → 배경 상속
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function inferType(el: DomElementSnapshot): A11yNode['type'] {
  const tag = el.tag.toLowerCase();
  if (tag === 'img' || el.role === 'img') return 'image';
  if (tag === 'a') return 'link';
  if (tag === 'button' || el.role === 'button') return 'button';
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return 'input';
  if (tag === 'svg' || el.role === 'img') return 'icon';
  if (HEADING.test(tag) || tag === 'p' || tag === 'span' || tag === 'label' || tag === 'li') return 'text';
  return 'container';
}

function accessibleLabel(el: DomElementSnapshot): string | null {
  const a = el.attrs ?? {};
  return a['aria-label'] ?? a['aria-labelledby-text'] ?? a.title ?? (el.text?.trim() || null);
}

/** 재귀 변환. inheritedBg = 조상에서 내려온 유효 배경색. */
function convert(el: DomElementSnapshot, inheritedBg: string): A11yNode {
  const type = inferType(el);
  const ownBg = cssColorToHex(el.style?.backgroundColor);
  const effBg = ownBg ?? inheritedBg;
  const tag = el.tag.toLowerCase();
  const headingMatch = tag.match(HEADING);

  const node: A11yNode = {
    id: el.id,
    type,
    name: el.text?.trim() || el.attrs?.['aria-label'] || tag,
    bgColor: effBg,
    semanticsReliable: true, // HTML 은 실제 의미정보 보유
    raw: undefined,
  };

  if (el.rect) {
    node.width = el.rect.width;
    node.height = el.rect.height;
  }

  const st = el.style;
  if (st) {
    node.fgColor = cssColorToHex(st.color) ?? undefined;
    node.fontSizePx = st.fontSizePx;
    node.fontWeight = st.fontWeight;
    node.bold = (st.fontWeight ?? 400) >= 600;
    node.lineHeightPx = st.lineHeightPx;
    node.letterSpacingPx = st.letterSpacingPx;
    if (st.textDecorationLine) {
      node.textDecoration = st.textDecorationLine.includes('underline') ? 'underline' : 'none';
    }
  }

  if (headingMatch) node.headingLevel = parseInt(headingMatch[1], 10);

  if (type === 'image') {
    const alt = el.attrs?.alt;
    node.altText = alt === undefined ? null : alt;
    node.decorative = el.role === 'presentation' || el.attrs?.['aria-hidden'] === 'true' || alt === '';
  }

  if (type === 'button' || type === 'input' || type === 'link') {
    const tabindex = el.attrs?.tabindex;
    node.focusable = INTERACTIVE_TAGS.has(tag) || (tabindex != null && parseInt(tabindex, 10) >= 0);
    // 콜렉터가 측정한 :focus 아웃라인. 미측정 시 UA 기본 아웃라인 가정(true)으로 오탐 방지.
    node.hasVisibleFocusStyle = st?.focusVisible ?? true;
    node.label = accessibleLabel(el);
  }

  if (el.children && el.children.length > 0) {
    node.children = el.children.map((c) => convert(c, effBg));
  }
  return node;
}

/** DOM 스냅샷 → A11yNode 트리(루트 배열) */
export function snapshotToA11yNodes(snapshot: DomSnapshot, pageBg = '#ffffff'): A11yNode[] {
  return [convert(snapshot.root, pageBg)];
}
