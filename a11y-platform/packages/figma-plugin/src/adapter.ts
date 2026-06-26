/// <reference types="@figma/plugin-typings" />
import type { A11yNode } from '@app/core';

/** RGB(0-1) → hex */
export function paintToHex(color: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(color.r)}${c(color.g)}${c(color.b)}`;
}

/** hex → RGB(0-1) (figma fill 적용용) */
export function hexToPaintRgb(hex: string): RGB {
  const h = hex.replace(/^#/, '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

/** 노드의 첫 번째 보이는 SolidPaint 를 반환 (opacity≈1 인 것 우선) */
function firstVisibleSolid(paints: readonly Paint[] | typeof figma.mixed | undefined): SolidPaint | null {
  if (!paints || paints === figma.mixed || !Array.isArray(paints)) return null;
  for (const p of paints as Paint[]) {
    if (p.type === 'SOLID' && p.visible !== false) return p;
  }
  return null;
}

function hasSolidFill(node: BaseNode): node is SceneNode & { fills: readonly Paint[] } {
  return 'fills' in node && firstVisibleSolid((node as GeometryMixin).fills) != null;
}

/**
 * 유효 배경색 산출: 자기 자신 제외, 부모 체인을 올라가며
 * 불투명에 가까운 SolidPaint 를 가진 첫 컨테이너의 색을 반환.
 * 없으면 페이지 배경(보통 흰색) 가정.
 */
export function resolveEffectiveBg(node: SceneNode): string {
  let cur: BaseNode | null = node.parent;
  while (cur) {
    if (hasSolidFill(cur)) {
      const solid = firstVisibleSolid((cur as GeometryMixin).fills)!;
      // 반투명 배경은 건너뛰고 더 위로 (단순화: opacity<0.5 는 무시)
      if ((solid.opacity ?? 1) >= 0.5) return paintToHex(solid.color);
    }
    cur = cur.parent;
  }
  return '#ffffff';
}

function isBold(node: TextNode): boolean {
  const fn = node.fontName;
  if (fn === figma.mixed) return false;
  return /bold|black|heavy|semibold|extrabold/i.test(fn.style);
}

function fontSizeOf(node: TextNode): number | undefined {
  const fs = node.fontSize;
  return fs === figma.mixed ? undefined : fs;
}

/** Figma 노드 타입 → A11yNode.type 추론 */
function inferType(node: SceneNode): A11yNode['type'] {
  if (node.type === 'TEXT') return 'text';
  const name = node.name.toLowerCase();
  if (/btn|button|버튼|cta/.test(name)) return 'button';
  if (/input|field|입력|텍스트필드/.test(name)) return 'input';
  if (/icon|아이콘/.test(name)) return 'icon';
  if (/link|링크/.test(name)) return 'link';
  if ('fills' in node && Array.isArray((node as GeometryMixin).fills)) {
    const imageFill = ((node as GeometryMixin).fills as Paint[]).some((p) => p.type === 'IMAGE');
    if (imageFill) return 'image';
  }
  if (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT' || node.type === 'INSTANCE')
    return 'container';
  return 'container';
}

/** 텍스트 노드의 전경색 (첫 SolidPaint) */
function textFgColor(node: TextNode): string | undefined {
  const solid = firstVisibleSolid(node.fills);
  return solid ? paintToHex(solid.color) : undefined;
}

/** 컨테이너/아이콘 등의 대표 전경색 (stroke 또는 fill) */
function shapeFgColor(node: SceneNode): string | undefined {
  if ('fills' in node) {
    const solid = firstVisibleSolid((node as GeometryMixin).fills);
    if (solid) return paintToHex(solid.color);
  }
  if ('strokes' in node) {
    const solid = firstVisibleSolid((node as GeometryMixin).strokes);
    if (solid) return paintToHex(solid.color);
  }
  return undefined;
}

/** 접근 가능한 이름 후보(레이어 이름은 보조). Figma 에는 alt/label 개념이 없어 휴리스틱. */
function accessibleName(node: SceneNode): string | undefined {
  // 버튼/링크 컨테이너 내부 텍스트를 이름으로 사용
  if ('findOne' in node) {
    const txt = (node as ChildrenMixin).findOne?.((c) => c.type === 'TEXT') as TextNode | null;
    if (txt && txt.characters.trim()) return txt.characters.trim();
  }
  if (node.type === 'TEXT' && node.characters.trim()) return node.characters.trim();
  return undefined;
}

/**
 * SceneNode → A11yNode (children 재귀). raw 에 원본 핸들을 보존해
 * 보정 적용 시 다시 찾을 수 있게 한다.
 */
export function toA11yNode(node: SceneNode, depth = 0): A11yNode {
  const type = inferType(node);
  const bg = resolveEffectiveBg(node);

  const base: A11yNode = {
    id: node.id,
    type,
    name: node.name,
    bgColor: bg,
    width: 'width' in node ? node.width : undefined,
    height: 'height' in node ? node.height : undefined,
    raw: node,
  };

  if (node.type === 'TEXT') {
    base.fgColor = textFgColor(node);
    base.fontSizePx = fontSizeOf(node);
    base.bold = isBold(node);
    base.fontWeight = isBold(node) ? 700 : 400;
  } else {
    base.fgColor = shapeFgColor(node);
  }

  if (type === 'button' || type === 'input' || type === 'link') {
    base.focusable = true;
    // Figma 에는 포커스 스타일 개념이 없음 → manual 성격이나, variant/이름 휴리스틱
    base.hasVisibleFocusStyle = /focus|포커스/i.test(node.name);
    base.label = accessibleName(node) ?? null;
  }

  if (type === 'image') {
    // Figma 에 alt 없음 → 항상 미상(null) 으로 두어 검출되게 함
    base.altText = null;
    base.decorative = /deco|장식|bg|배경/i.test(node.name);
  }

  // 컨테이너는 children 재귀 (텍스트는 leaf)
  if ('children' in node && depth < 60) {
    base.children = node.children.map((c) => toA11yNode(c, depth + 1));
  }

  return base;
}

/** 선택 또는 페이지 전체를 A11yNode 루트 배열로 변환 */
export function collectRoots(scope: 'selection' | 'page'): A11yNode[] {
  const roots: readonly SceneNode[] =
    scope === 'selection' && figma.currentPage.selection.length > 0
      ? figma.currentPage.selection
      : figma.currentPage.children;
  return roots.map((n) => toA11yNode(n));
}
