import { describe, it, expect } from 'vitest';
import { buildServer } from '../server';
import type { DomSnapshot } from '../htmlAdapter';

const SNAP: DomSnapshot = {
  root: {
    id: 'r',
    tag: 'main',
    style: { backgroundColor: 'rgb(255,255,255)' },
    children: [
      { id: 'p', tag: 'p', text: '회색 본문', style: { color: 'rgb(170,170,170)', fontSizePx: 14 } },
      { id: 'img', tag: 'img', attrs: {}, rect: { width: 100, height: 80 } },
    ],
  },
};

describe('D — Fastify 서버 (inject, 브라우저 불필요)', () => {
  it('GET /health', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it('POST /v1/scan (html) → ScanResult', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'POST', url: '/v1/scan', payload: { source: 'html', payload: { snapshot: SNAP } } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.findings.length).toBeGreaterThan(0);
    expect(body.data.findings.some((f: { ruleId: string; status: string }) => f.ruleId === 'contrast.text' && f.status === 'fail')).toBe(true);
    await app.close();
  });

  it('POST /v1/scan (url) without url → 400', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'POST', url: '/v1/scan', payload: { source: 'url', payload: {} } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /v1/fix → diff, POST /v1/report → breakdown', async () => {
    const app = buildServer();
    const scan = (await app.inject({ method: 'POST', url: '/v1/scan', payload: { source: 'html', payload: { snapshot: SNAP } } })).json().data;
    const fix = await app.inject({ method: 'POST', url: '/v1/fix', payload: { scanResult: scan, acceptRuleIds: ['contrast.text'] } });
    expect(fix.json().data.diff.length).toBeGreaterThan(0);
    const report = await app.inject({ method: 'POST', url: '/v1/report', payload: scan });
    expect(report.json().data.breakdown).toBeDefined();
    await app.close();
  });

  it('POST /v1/alt (주입 프로바이더) → ai-assisted 제안', async () => {
    // 네트워크 없이 결정론 프로바이더를 주입해 라우트만 검증
    const app = buildServer({
      altProvider: {
        async suggestAltText() {
          return { alt: '한라산 정상 풍경', confidence: 0.8, isDecorative: false, rationale: 'mock' };
        },
        async assessContextual() {
          return { verdict: 'unsure', rationale: '', confidence: 0.2 };
        },
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/alt',
      payload: { nodeId: 'hero', name: 'photo', surroundingText: '제주 여행' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('ai-assisted');
    expect(body.data.alt).toBe('한라산 정상 풍경');
    await app.close();
  });

  it('POST /v1/alt without nodeId → 400', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'POST', url: '/v1/alt', payload: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
