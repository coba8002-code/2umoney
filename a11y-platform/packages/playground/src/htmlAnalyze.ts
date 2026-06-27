/**
 * 브라우저에서 임의 HTML 을 렌더·측정해 접근성 분석.
 * 서버 없이 동작: 오프스크린에 렌더 → getComputedStyle 로 DomSnapshot 직렬화
 * → @app/api 의 scanSnapshot(코어 룰셋 재사용)으로 검사.
 */
import { scanSnapshot, type DomSnapshot, type DomElementSnapshot } from '@app/api';
import type { ScanResult } from '@app/core';

/** <script> 및 이벤트 핸들러 제거 (자기 브라우저지만 안전하게) */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

const px = (v: string): number | undefined => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
};

function toSnap(el: Element, seq: { n: number }): DomElementSnapshot {
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const tag = el.tagName.toLowerCase();

  const attrs: DomElementSnapshot['attrs'] = {};
  if (el.hasAttribute('alt')) attrs.alt = el.getAttribute('alt');
  const aria = el.getAttribute('aria-label');
  if (aria) attrs['aria-label'] = aria;
  if (el.getAttribute('aria-hidden')) attrs['aria-hidden'] = el.getAttribute('aria-hidden')!;
  if (el.getAttribute('href')) attrs.href = el.getAttribute('href')!;
  if (el.getAttribute('tabindex')) attrs.tabindex = el.getAttribute('tabindex')!;
  if (el.getAttribute('title')) attrs.title = el.getAttribute('title')!;

  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent)
    .join('')
    .trim();

  const node: DomElementSnapshot = {
    id: el.id || `n${seq.n++}`,
    tag,
    role: el.getAttribute('role') || undefined,
    text: directText || undefined,
    attrs,
    style: {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSizePx: px(cs.fontSize),
      fontWeight: px(cs.fontWeight),
      lineHeightPx: cs.lineHeight === 'normal' ? undefined : px(cs.lineHeight),
      letterSpacingPx: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
      textDecorationLine: cs.textDecorationLine,
    },
    rect: { width: rect.width, height: rect.height },
    children: [],
  };

  for (const child of Array.from(el.children)) {
    if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
    node.children!.push(toSnap(child, seq));
  }
  return node;
}

export function analyzeHtml(html: string, palette?: string[]): ScanResult {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1024px;background:#ffffff';
  host.innerHTML = sanitize(html);
  document.body.appendChild(host);
  try {
    const snapshot: DomSnapshot = { root: toSnap(host, { n: 0 }) };
    return scanSnapshot(snapshot, { palette });
  } finally {
    document.body.removeChild(host);
  }
}
