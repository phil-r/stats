import type { onRequestHookHandler } from 'fastify';
import onHeaders from 'on-headers';
import { expressStats } from './express.js';
import { getCollector } from './internal.js';
import type { StatsCollector } from './types.js';

/**
 * Create an HTTP/1 onRequest hook (not a plugin for register()).
 * Add before routes and early hooks, once in the desired encapsulation scope.
 * For Nest/Fastify, add to the native instance after create, before init/listen.
 * Records at header write, not body completion; preserves staged/raw timing headers.
 * @param stats - Collector returned by createStats().
 */
export function fastifyStats(stats: StatsCollector): onRequestHookHandler {
  const middleware = expressStats(stats);
  const { addHeader } = getCollector(stats);
  return function (request, reply, done) {
    middleware(request.raw, reply.raw, () => {
      if (addHeader) {
        // Runs before the middleware's header listener. Also honors staged
        // headers when a handler writes directly to reply.raw.
        onHeaders(reply.raw, () => {
          const existing = reply.getHeader('X-Response-Time');
          if (
            !reply.raw.hasHeader('X-Response-Time') &&
            existing !== undefined
          ) {
            reply.raw.setHeader('X-Response-Time', existing);
          }
        });
      }
      done();
    });
  };
}
