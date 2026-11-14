# Integration guide

## NestJS

Use the platform adapter **after `create`, before `init`/`listen`** and before
middleware that may respond early. No Nest module, interceptor or `/nestjs`
export is needed. Install Nest and its platform dependencies separately.

```ts
import { NestFactory } from '@nestjs/core';
import { createStats } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
import { AppModule } from './app.module.js';

const stats = createStats();
const app = await NestFactory.create(AppModule);
app.use(expressStats(stats));
await app.listen(8080);
```

For Fastify, create with `new FastifyAdapter()` from
`@nestjs/platform-fastify`, then register its native hook instead of `app.use`:

```ts
import { fastifyStats } from '@phil-r/stats/fastify';

app.getHttpAdapter().getInstance().addHook('onRequest', fastifyStats(stats));
```

Group patterns must include any global prefix, e.g. `/api/user/:id`.
See [runnable examples](../examples) for both platforms.

## Timing and adapter limits

- Express/Node, Fastify and Nest record the final status when headers are written;
  `originalUrl` preserves mounted paths. Fastify's HTTP/1 hook is not a
  `register()` plugin: register at root for all routes/404s, or inside a plugin
  before its routes for that scope. HTTP/2 is unsupported.
- Elysia and Hono record when the final Response is ready, including early
  responses, errors, validation failures and 404s. Streams are not buffered or
  awaited; immutable headers do not discard the body. Hono requires Node/Bun,
  must be registered first, and error handlers must return a Response normally.
  Errors escaping without a Response and requests rejected by Bun before Elysia
  are not counted.
- No adapter measures body transmission or counts requests aborted before a
  response/headers. A stats JSON response excludes its own request, which is
  recorded after serialization.
- Times are monotonic milliseconds; averages are total/count. Custom `started`
  counts all starts, `count` only finishes. Uptime is process uptime, not collector
  age. Counters and unique keys are in-memory and unbounded; nested output maps
  are live/read-only. Clone or serialize for a durable snapshot.

Tested: Elysia **1.4.32** (advanced `wrap` API; restricted to 1.4.x), Express
**5.3.0**, Fastify **5.12.8**, Hono **4.13.18** (`@hono/node-server` **2.1.8**),
Nest and both platform adapters **12.5.0**, on Node **22.23.5/24.22.2** and Bun.
Older Nest majors and other platforms are unverified; retest before widening
Elysia support.

## From v1

Use named ESM `createStats` and framework-specific adapter imports, passing
the collector instead of options. Replace `statsMiddleware`/`statsPlugin` and
move measurement calls onto the collector. Node 22+ is required; there is no
CJS build, framework registry or dashboard.

## Development

Use the pinned [Bun](../.bun-version) and [Node](../.node-version) versions.

```sh
bun install --frozen-lockfile
bun run format:check  # bun run format to fix
bun check
bun test
bun run build
bun run test:node
bun run test:package
```

Build emits ESM and declarations; checks do not emit. CI tests Node 22/24,
including real framework listeners. The package smoke test verifies packed
exports and peer-free Node imports/declarations, not framework behavior.
