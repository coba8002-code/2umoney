/**
 * D: Fastify 서버 — REST 엔드포인트로 접근성 분석/보정/리포트 제공.
 * source='url' 은 서버측 Playwright 콜렉터로 수집(브라우저 CORS 제약 없음).
 *   POST /v1/scan   { source:'html'|'url', payload } -> ScanResult
 *   POST /v1/fix    { scanResult, acceptRuleIds[] }  -> { diff }
 *   POST /v1/report  ScanResult                       -> A11yReport
 *   GET  /health
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { handleScan, handleFix, handleReport, type ScanRequest } from './routes';
import { scanSnapshot } from './scanService';
import { collectFromUrl } from './collect';
import type { ScanResult } from '@app/core';

export interface ServerOptions {
  /** 사전 설치 Chromium 경로 (URL 수집용) */
  chromiumPath?: string;
  /** axe-core 소스(주입 시 url 수집에서 axe 실행) */
  axeSource?: string;
}

export function buildServer(opts: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true }));

  app.post('/v1/scan', async (req, reply) => {
    const body = req.body as ScanRequest;
    if (body?.source === 'url') {
      const url = body.payload?.url;
      if (!url) return reply.code(400).send({ ok: false, status: 400, error: 'payload.url 이 필요합니다.' });
      const { snapshot, axeViolations } = await collectFromUrl(url, {
        executablePath: opts.chromiumPath,
        axeSource: opts.axeSource,
      });
      const result = scanSnapshot(snapshot, { axeViolations, palette: body.payload.options?.palette });
      return reply.send({ ok: true, status: 200, data: result });
    }
    const res = handleScan(body);
    return reply.code(res.status).send(res);
  });

  app.post('/v1/fix', async (req, reply) => {
    const body = req.body as { scanResult: ScanResult; acceptRuleIds?: string[] };
    const res = handleFix(body.scanResult, body.acceptRuleIds ?? []);
    return reply.code(res.status).send(res);
  });

  app.post('/v1/report', async (req, reply) => {
    const res = handleReport(req.body as ScanResult);
    return reply.code(res.status).send(res);
  });

  return app;
}
