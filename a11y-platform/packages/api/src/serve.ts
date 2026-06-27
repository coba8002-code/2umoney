/** 서버 실행 진입점. PORT, CHROMIUM_PATH 환경변수 지원. */
import { buildServer } from './server';

const port = Number(process.env.PORT ?? 3001);
const app = buildServer({ chromiumPath: process.env.CHROMIUM_PATH });

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => app.log.info(`a11y API listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
