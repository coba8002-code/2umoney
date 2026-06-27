import { describe, it, expect, vi } from 'vitest';
import { fetchViaProxy, analyzeSite, analyzeUnity, normalizeUrl, DEFAULT_URL_PROXIES } from './analyzers';

function okText(text: string): Response {
  return { ok: true, status: 200, text: async () => text } as unknown as Response;
}
function fail(status: number): Response {
  return { ok: false, status, text: async () => '' } as unknown as Response;
}

describe('URL 가져오기 — 프록시 폴백', () => {
  it('첫 프록시가 실패하면 다음 프록시로 넘어가 성공한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fail(503)) // 1번째 프록시 다운
      .mockResolvedValueOnce(okText('<html><body>OK</body></html>')); // 2번째 성공
    const html = await fetchViaProxy('example.com', { fetchImpl });
    expect(html).toContain('OK');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('네트워크 오류(throw)도 다음 프록시로 폴백', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okText('<html>RECOVERED</html>'));
    const html = await fetchViaProxy('https://example.com', { fetchImpl });
    expect(html).toContain('RECOVERED');
  });

  it('모두 실패하면 사유를 모아 안내 메시지로 throw', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fail(403));
    await expect(fetchViaProxy('example.com', { fetchImpl })).rejects.toThrow(/프록시 모두 실패|가져오지 못했/);
    expect(fetchImpl).toHaveBeenCalledTimes(DEFAULT_URL_PROXIES.length);
  });

  it('빈 응답은 실패로 간주하고 다음으로', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okText('   '))
      .mockResolvedValueOnce(okText('<html>NONEMPTY</html>'));
    expect(await fetchViaProxy('example.com', { fetchImpl })).toContain('NONEMPTY');
  });

  it('스킴 없는 입력에 https 를 붙인다', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('http://x.io')).toBe('http://x.io');
  });
});

describe('크롤 결과 병합 — analyzeSite', () => {
  it('여러 페이지 findings 를 합치고 경로를 항목명에 붙인다', async () => {
    const crawlResponse = {
      data: {
        pages: [
          {
            url: 'https://ex.com/',
            result: {
              findings: [
                { nodeId: 'a', nodeName: '본문', ruleId: 'contrast.text', status: 'fail' },
                { nodeId: 'b', nodeName: '제목', ruleId: 'heading.structure', status: 'pass' },
              ],
            },
          },
          {
            url: 'https://ex.com/about',
            result: { findings: [{ nodeId: 'c', nodeName: '링크', ruleId: 'link.identifiable', status: 'fail' }] },
          },
        ],
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => crawlResponse } as unknown as Response);
    vi.stubGlobal('fetch', fetchImpl);
    try {
      const res = await analyzeSite('ex.com', { serverBase: 'https://api.host' });
      expect(res.findings).toHaveLength(3);
      expect(res.summary.fail).toBe(2);
      expect(res.summary.pass).toBe(1);
      // 항목명에 페이지 경로가 접두로 붙는다
      expect(res.findings[0].nodeName).toBe('[/] 본문');
      expect(res.findings[2].nodeName).toBe('[/about] 링크');
      // 엔드포인트가 /v1/crawl 로 구성됐는지
      expect(fetchImpl.mock.calls[0][0]).toBe('https://api.host/v1/crawl');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('페이지가 없으면 명확히 에러', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { pages: [] } }) } as unknown as Response);
    vi.stubGlobal('fetch', fetchImpl);
    try {
      await expect(analyzeSite('ex.com', { serverBase: 'https://api.host' })).rejects.toThrow(/수집된 페이지가 없/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('Unity export 분석 — analyzeUnity', () => {
  it('export JSON 을 파싱해 결정론 룰셋으로 검사', () => {
    const json = JSON.stringify({
      screenBg: '#ffffff',
      root: {
        id: 'c', kind: 'Canvas', backgroundColor: '#ffffff',
        children: [
          { id: 't', kind: 'TMP_Text', text: '안내', color: '#aaaaaa', fontSizePx: 18 },
          { id: 'b', kind: 'Button', backgroundColor: '#1976d2', rect: { width: 24, height: 24 } },
        ],
      },
    });
    const { findings } = analyzeUnity(json);
    expect(findings.find((f) => f.ruleId === 'contrast.text' && f.nodeId === 't')?.status).toBe('fail');
    expect(findings.find((f) => f.ruleId === 'target.size' && f.nodeId === 'b')?.status).toBe('fail');
  });

  it('잘못된 JSON 은 친절한 에러', () => {
    expect(() => analyzeUnity('{not json')).toThrow(/JSON 형식/);
  });
});
