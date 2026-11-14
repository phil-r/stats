# stats

[![NPM version](https://img.shields.io/npm/v/@phil-r/stats.svg?style=flat-square)](https://www.npmjs.com/package/@phil-r/stats)
[![build status](https://github.com/phil-r/stats/workflows/Testing/badge.svg)](https://github.com/phil-r/stats/actions)
[![code coverage](https://img.shields.io/codecov/c/github/phil-r/stats.svg?style=flat-square)](https://codecov.io/gh/phil-r/stats)

Small in-memory request statistics collector for Elysia, Express/Node HTTP,
Fastify, Hono and NestJS (Express and Fastify platforms). TypeScript-first,
ESM-only, for Node **22+** and Bun. Other frameworks may be integrated through
an appropriate adapter.

## Installation

```sh
npm install @phil-r/stats
# or: bun add @phil-r/stats
```

Install your framework separately. Framework peers are optional, and the root
export loads no framework. No stats endpoint is exposed automatically; protect
any endpoint you add.

## Usage

Create a collector and install the adapter **before routes or middleware that
may respond early**. Share a collector to aggregate counts across adapters;
install each adapter once per request path (Elysia deduplicates by collector).

### Elysia

```ts
import { Elysia } from 'elysia';
import { createStats } from '@phil-r/stats';
import { elysiaStats } from '@phil-r/stats/elysia';

const stats = createStats({ endpointStats: true, addHeader: true });
new Elysia()
  .use(elysiaStats(stats))
  .get('/', () => 'Hello')
  .get('/stats', () => stats.getStats())
  .listen(8080);
```

### Express / Node HTTP

```ts
import express from 'express';
import { createStats } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';

const stats = createStats();
const app = express();
app.use(expressStats(stats));
app.get('/', (_req, res) => res.send('Hello'));
app.listen(8080);
```

The middleware also accepts Node `IncomingMessage`/`ServerResponse` and `next`,
without importing Express at runtime.

### Fastify and Hono

With a collector named `stats`, register the appropriate adapter:

```ts
import { fastifyStats } from '@phil-r/stats/fastify';
// Fastify: native HTTP/1 hook, not a plugin for register().
app.addHook('onRequest', fastifyStats(stats));
```

```ts
import { honoStats } from '@phil-r/stats/hono';
// Hono on Node/Bun, not edge runtimes: install first.
app.use('*', honoStats(stats));
```

For NestJS, use its platform's adapter after `create`, before `init`/`listen`.
See [Nest examples and integration details](./docs/guide.md) or
[runnable apps](./examples).

## Collector API

`createStats(options?)` returns an independent collector. Features are disabled
by default; paths are unchanged unless normalized or grouped:

- `endpointStats`: per-method/path totals, excluding query strings.
- `endpointNormalizer`: synchronous `(pathname: string) => string`, called only
  with `endpointStats` enabled. Receives the query-free pathname before
  `complexEndpoints` matching and counter allocation; HTTP methods stay separate.
  Exceptions are not caught, so keep the callback non-throwing.
- `complexEndpoints`: ordered regexparam patterns, e.g. `['/user/:id']`; first
  match groups dynamic URLs. Use with `endpointStats` to limit unique keys.
- `customStats`: include named custom measurements in output.
- `addHeader`: add `X-Response-Time: Nms`, preserving existing values.

Normalize noisy bot paths before allocating counters, alongside dynamic routes:

```ts
const stats = createStats({
  endpointStats: true,
  endpointNormalizer: (pathname) =>
    pathname.endsWith('.php') ? '/*.php' : pathname,
  complexEndpoints: ['/user/:id'],
});
```

`stats.getStats()` returns request count, total/average milliseconds, status
counts, process identity/uptime and enabled endpoint/custom totals. Nested maps
are live; treat them as read-only. Counters are process-local and unbounded.

```ts
const stats = createStats({ customStats: true });
const measurement = stats.startMeasurement('work');
try {
  await doWork();
} finally {
  stats.finishMeasurement(measurement);
}
```

Finish each token once on its originating collector. Timings are monotonic
milliseconds, not body-transmission times. See the [guide](./docs/guide.md) for
precise adapter timing, supported versions, migration and development commands.

## License

[MIT](LICENSE).
