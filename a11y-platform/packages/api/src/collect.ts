/**
 * D: 헤드리스 브라우저 수집기 — URL 을 렌더링해 계산 스타일을 포함한
 * DomSnapshot 을 직렬화하고, 선택적으로 axe-core 를 실행한다.
 *
 * 런타임에서만 동작(브라우저 필요). 단위 테스트 대상 아님.
 * playwright-core 는 동적 import(가변 지정자)로 로드해 빌드 의존성을 분리한다.
 */
import type { DomSnapshot } from './htmlAdapter';
import type { AxeViolationLike } from './scanService';

export interface CollectOptions {
  executablePath?: string; // 사전 설치 Chromium 경로
  axeSource?: string; // axe.min.js 소스 문자열(주입 시 axe 실행)
  timeoutMs?: number;
}

export interface CollectResult {
  snapshot: DomSnapshot;
  axeViolations: AxeViolationLike[];
}

/** 브라우저 컨텍스트에서 실행되는 DOM 직렬화기 (self-contained) */
const SERIALIZER = `(() => {
  let seq = 0;
  function toSnap(el) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const px = (v) => { const n = parseFloat(v); return isNaN(n) ? undefined : n; };
    const attrs = {};
    if (el.hasAttribute('alt')) attrs.alt = el.getAttribute('alt');
    if (el.getAttribute('aria-label')) attrs['aria-label'] = el.getAttribute('aria-label');
    if (el.getAttribute('aria-hidden')) attrs['aria-hidden'] = el.getAttribute('aria-hidden');
    if (el.getAttribute('href')) attrs.href = el.getAttribute('href');
    if (el.getAttribute('tabindex')) attrs.tabindex = el.getAttribute('tabindex');
    if (el.getAttribute('title')) attrs.title = el.getAttribute('title');
    const directText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const node = {
      id: el.id || ('n' + (seq++)),
      tag,
      role: el.getAttribute('role') || undefined,
      text: directText || undefined,
      attrs,
      style: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSizePx: px(cs.fontSize),
        fontWeight: px(cs.fontWeight),
        lineHeightPx: px(cs.lineHeight),
        letterSpacingPx: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
        textDecorationLine: cs.textDecorationLine,
      },
      rect: { width: rect.width, height: rect.height },
      children: [],
    };
    for (const child of el.children) {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
      node.children.push(toSnap(child));
    }
    return node;
  }
  return { root: toSnap(document.body) };
})()`;

/** 모든 a[href] 의 절대 URL 을 수집 (브라우저가 base 기준으로 해석) */
export const LINK_EXTRACTOR = `(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href))()`;

/** playwright-core 를 가변 지정자로 동적 로드(빌드 의존성 분리) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPlaywright(): Promise<any> {
  const specifier = 'playwright-core';
  return import(specifier);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function launchArgs(opts: CollectOptions): any {
  return opts.executablePath
    ? { executablePath: opts.executablePath, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] };
}

/** 이미 열린 page 에서 (선택적 axe 실행 후) 스냅샷을 직렬화한다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collectFromPage(page: any, opts: CollectOptions = {}): Promise<CollectResult> {
  let axeViolations: AxeViolationLike[] = [];
  if (opts.axeSource) {
    await page.addScriptTag({ content: opts.axeSource });
    const axeRes = await page.evaluate(`window.axe.run()`);
    axeViolations = (axeRes?.violations ?? []) as AxeViolationLike[];
  }
  const snapshot = (await page.evaluate(SERIALIZER)) as DomSnapshot;
  return { snapshot, axeViolations };
}

export async function collectFromUrl(url: string, opts: CollectOptions = {}): Promise<CollectResult> {
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch(launchArgs(opts));
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeoutMs ?? 30000 });
    return await collectFromPage(page, opts);
  } finally {
    await browser.close();
  }
}
