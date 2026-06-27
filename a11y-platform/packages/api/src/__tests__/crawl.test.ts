import { describe, it, expect } from 'vitest';
import { normalizeLink, selectCrawlTargets } from '../crawl';

describe('crawl — normalizeLink', () => {
  it('상대 경로를 절대 URL 로 해석', () => {
    expect(normalizeLink('/about', 'https://ex.com/home')).toBe('https://ex.com/about');
    expect(normalizeLink('sub/page', 'https://ex.com/dir/')).toBe('https://ex.com/dir/sub/page');
  });
  it('해시(#)는 제거한다', () => {
    expect(normalizeLink('/p#section', 'https://ex.com')).toBe('https://ex.com/p');
  });
  it('http(s) 가 아니면 null (mailto, tel, javascript)', () => {
    expect(normalizeLink('mailto:a@b.com', 'https://ex.com')).toBeNull();
    expect(normalizeLink('tel:123', 'https://ex.com')).toBeNull();
    expect(normalizeLink('javascript:void(0)', 'https://ex.com')).toBeNull();
  });
});

describe('crawl — selectCrawlTargets', () => {
  const base = 'https://ex.com/start';

  it('동일 출처만, 중복·방문분 제외', () => {
    const seen = new Set(['https://ex.com/start']);
    const hrefs = [
      'https://ex.com/a',
      '/b',
      'https://ex.com/a', // 중복
      'https://other.com/c', // 외부 출처 제외
      'https://ex.com/start', // 방문분 제외
      'mailto:x@y.com', // 비http 제외
    ];
    expect(selectCrawlTargets(base, hrefs, seen)).toEqual(['https://ex.com/a', 'https://ex.com/b']);
  });

  it('sameOrigin=false 면 외부 링크도 포함', () => {
    const out = selectCrawlTargets(base, ['https://other.com/c'], new Set(), { sameOrigin: false });
    expect(out).toEqual(['https://other.com/c']);
  });

  it('pathPrefix 로 하위 경로만 따라간다', () => {
    const out = selectCrawlTargets(base, ['/docs/a', '/blog/b', '/docs/c'], new Set(), { pathPrefix: '/docs' });
    expect(out).toEqual(['https://ex.com/docs/a', 'https://ex.com/docs/c']);
  });

  it('해시만 다른 링크는 같은 페이지로 보고 한 번만', () => {
    const out = selectCrawlTargets(base, ['/p#a', '/p#b', '/p'], new Set());
    expect(out).toEqual(['https://ex.com/p']);
  });
});
