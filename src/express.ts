import type { IncomingMessage, ServerResponse } from 'node:http';
import onHeaders from 'on-headers';
import type { StatsCollector } from './types.js';
import { getCollector, hrTimeToMs } from './internal.js';

/**
 * Create Express/Node HTTP middleware that records when response headers are written.
 * Install before routes and any middleware that may respond early; for Nest's
 * Express platform, install after create and before init/listen. Uses originalUrl
 * for mounted routers and preserves existing response-time headers. Aborted
 * requests without headers are not counted; body transmission is not measured.
 * @param stats - Collector returned by createStats(); install once per request path.
 */
export function expressStats(stats: StatsCollector) {
  const { record, addHeader } = getCollector(stats);
  return function statsMiddleware(
    req: IncomingMessage & { originalUrl?: string },
    res: ServerResponse,
    next: () => void,
  ): void {
    const start = process.hrtime();
    const method = req.method || 'GET';
    const url = req.originalUrl || req.url || '/';
    onHeaders(res, () => {
      const elapsed = hrTimeToMs(process.hrtime(start));
      if (addHeader && !res.hasHeader('X-Response-Time')) {
        res.setHeader('X-Response-Time', `${elapsed.toFixed(0)}ms`);
      }
      record(method, url, res.statusCode, elapsed);
    });
    next();
  };
}
