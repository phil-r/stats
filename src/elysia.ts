import { Elysia } from 'elysia';
import type { StatsCollector } from './types.js';
import { getCollector, hrTimeToMs } from './internal.js';

type FetchHandler = (
  request: Request,
  ...rest: unknown[]
) => Response | Promise<Response>;

/**
 * Create a plugin measuring until Elysia produces its final Response, not body transmission.
 * Install with `.use(elysiaStats(stats))` before routes. The collector UUID seeds
 * plugin deduplication: reusing one collector counts each request only once.
 * Existing response-time headers are preserved. Requires Elysia 1.4.x on Bun.
 * @param stats - Collector returned by createStats().
 */
export function elysiaStats(stats: StatsCollector): Elysia {
  const { record, addHeader } = getCollector(stats);
  // A fetch wrapper also sees early onRequest returns that skip lifecycle hooks.
  const wrap =
    (handle: FetchHandler) =>
    async (request: Request, ...rest: unknown[]) => {
      const start = process.hrtime();
      let response = await handle(request, ...rest);
      const elapsed = hrTimeToMs(process.hrtime(start));
      if (addHeader && !response.headers.has('X-Response-Time')) {
        try {
          response.headers.set('X-Response-Time', `${elapsed.toFixed(0)}ms`);
        } catch {
          // Fetch/redirect responses can have immutable headers; keep their body.
          response = new Response(response.body, response);
          response.headers.set('X-Response-Time', `${elapsed.toFixed(0)}ms`);
        }
      }
      record(request.method, request.url, response.status, elapsed);
      return response;
    };
  // Elysia 1.4's declaration describes wrap as a request-time hook, but
  // its runtime passes a fetch handler and expects a replacement handler.
  return new Elysia({ name: 'stats', seed: stats.getStats().uuid }).wrap(
    wrap as unknown as Parameters<Elysia['wrap']>[0],
  );
}
