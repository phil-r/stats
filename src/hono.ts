import type { MiddlewareHandler } from 'hono';
import type { StatsCollector } from './types.js';
import { getCollector, hrTimeToMs } from './internal.js';

/**
 * Create Node/Bun middleware; install first with app.use('*', honoStats(stats)).
 * Records after downstream middleware and Hono's error handler finalize a Response,
 * not after streaming its body. Escaping errors without a Response are not counted.
 * Preserves existing response-time headers. Install once per request path.
 * @param stats - Collector returned by createStats().
 */
export function honoStats(stats: StatsCollector): MiddlewareHandler {
  const { record, addHeader } = getCollector(stats);
  return async (context, next) => {
    const start = process.hrtime();
    const method = context.req.method;
    const url = context.req.url;
    await next();
    const elapsed = hrTimeToMs(process.hrtime(start));
    if (addHeader && !context.res.headers.has('X-Response-Time')) {
      // Clone headers, not the stream. Works for immutable fetch/redirect
      // responses too, without consuming or buffering the response body.
      const response = new Response(context.res.body, context.res);
      response.headers.set('X-Response-Time', `${elapsed.toFixed(0)}ms`);
      context.res = response;
    }
    record(method, url, context.res.status, elapsed);
  };
}
