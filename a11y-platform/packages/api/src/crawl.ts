/**
 * 동일 출처(same-origin) 크롤러 — 진입 URL 에서 하위 링크를 따라가며 여러 페이지를
 * 수집한다. 링크 선별 로직은 순수 함수로 분리해 단위 테스트하고, 실제 페이지 수집은
 * Playwright(런타임, 테스트 비대상)로 수행한다.
 */
import {
  loadPlaywright,
  launchArgs,
  collectFromPage,
  LINK_EXTRACTOR,
  type CollectOptions,
} from './collect';
import type { DomSnapshot } from './htmlAdapter';
import type { AxeViolationLike } from './scanService';

export interface CrawlPlanOptions {
  /** 같은 출처(origin)만 따라간다. 기본 true. */
  sameOrigin?: boolean;
  /** 같은 origin 안에서도 진입 경로 하위만(prefix) 따라가려면 지정. */
  pathPrefix?: string;
}

/** href 를 base 기준 절대 URL 로 정규화(+해시 제거). http(s) 아니면 null. */
export function normalizeLink(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

/**
 * 한 페이지에서 발견한 링크들 중 아직 보지 않은 크롤 대상만 추려 반환(정규화·중복 제거·출처 필터).
 * maxPages 적용은 호출하는 BFS 루프가 담당한다.
 */
export function selectCrawlTargets(
  baseUrl: string,
  hrefs: string[],
  seen: Set<string>,
  opts: CrawlPlanOptions = {},
): string[] {
  const sameOrigin = opts.sameOrigin ?? true;
  let baseOrigin = '';
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return [];
  }
  const out: string[] = [];
  const localSeen = new Set<string>();
  for (const href of hrefs) {
    const norm = normalizeLink(href, baseUrl);
    if (!norm) continue;
    if (seen.has(norm) || localSeen.has(norm)) continue;
    if (sameOrigin && new URL(norm).origin !== baseOrigin) continue;
    if (opts.pathPrefix && !new URL(norm).pathname.startsWith(opts.pathPrefix)) continue;
    localSeen.add(norm);
    out.push(norm);
  }
  return out;
}

export interface PageCollect {
  url: string;
  snapshot: DomSnapshot;
  axeViolations: AxeViolationLike[];
}

export interface SiteCollectOptions extends CollectOptions, CrawlPlanOptions {
  /** 최대 방문 페이지 수. 기본 5. */
  maxPages?: number;
}

export interface SiteCollectResult {
  pages: PageCollect[];
  /** 방문한 URL 순서 */
  visited: string[];
}

/**
 * 진입 URL 부터 BFS 로 동일 출처 페이지를 maxPages 까지 수집한다.
 * 브라우저는 한 번만 띄워 재사용한다.
 */
export async function collectSiteFromUrl(
  entryUrl: string,
  opts: SiteCollectOptions = {},
): Promise<SiteCollectResult> {
  const maxPages = Math.max(1, opts.maxPages ?? 5);
  const start = normalizeLink(entryUrl, entryUrl) ?? entryUrl;

  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch(launchArgs(opts));
  const pages: PageCollect[] = [];
  const visited = new Set<string>();
  const queue: string[] = [start];

  try {
    const page = await browser.newPage();
    while (queue.length > 0 && visited.size < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeoutMs ?? 30000 });
      } catch {
        // 한 페이지 로드 실패는 건너뛰고 계속(전체 크롤이 멈추지 않도록)
        visited.add(url);
        continue;
      }
      visited.add(url);
      const { snapshot, axeViolations } = await collectFromPage(page, opts);
      pages.push({ url, snapshot, axeViolations });

      if (visited.size < maxPages) {
        const hrefs = (await page.evaluate(LINK_EXTRACTOR)) as string[];
        const queued = new Set<string>([...visited, ...queue]);
        for (const t of selectCrawlTargets(url, hrefs, queued, opts)) {
          queue.push(t);
        }
      }
    }
    return { pages, visited: [...visited] };
  } finally {
    await browser.close();
  }
}
