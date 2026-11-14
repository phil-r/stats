import { describe, expect, test } from 'bun:test';
import { Elysia, status, t } from 'elysia';
import { createStats } from '../src/index.js';
import { elysiaStats } from '../src/elysia.js';

async function send(
  app: { handle(request: Request): Response | Promise<Response> },
  path = '/',
  init?: RequestInit,
) {
  const response = await app.handle(
    new Request(`http://localhost${path}`, init),
  );
  await response.text();
  return response;
}

describe('Elysia adapter', () => {
  test('counts strings, objects, Responses, statuses and queries', async () => {
    const stats = createStats({
      endpointStats: true,
      addHeader: true,
    });
    const { getStats } = stats;
    const app = new Elysia()
      .use(elysiaStats(stats))
      .get('/', () => 'Hello')
      .get('/json', () => ({ hello: true }))
      .get('/native', () => new Response('Created', { status: 201 }))
      .get('/status', () => status(202, 'Accepted'))
      .get('/named', ({ set }) => {
        set.status = 'No Content';
      });
    for (const path of ['/', '/json?foo=bar', '/native', '/status', '/named']) {
      const response = await send(app, path);
      expect(response.headers.get('x-response-time')).toMatch(/^\d+ms$/);
    }
    const result = getStats();
    expect(result.count).toBe(5);
    expect(result.statusCodes).toEqual({ 200: 2, 201: 1, 202: 1, 204: 1 });
    expect(result.endpointStats!['GET /json'].count).toBe(1);
    expect(result.averageTime).toBe(result.totalTime / 5);
  });

  test('counts early responses, errors, validation and unknown routes once', async () => {
    const stats = createStats({ addHeader: true });
    const { getStats } = stats;
    const app = new Elysia()
      .use(elysiaStats(stats))
      .onRequest(({ request }) => {
        if (new URL(request.url).pathname === '/early')
          return new Response('No', { status: 401 });
      })
      .get('/early', () => 'Unreachable')
      .get('/error', () => {
        throw new Error('Oops');
      })
      .post('/json', ({ body }) => body);
    const cases: [string, RequestInit | undefined, number][] = [
      ['/early', undefined, 401],
      ['/error', undefined, 500],
      ['/missing', undefined, 404],
      [
        '/json',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{',
        },
        400,
      ],
    ];
    for (const [path, init, code] of cases) {
      const response = await send(app, path, init);
      expect(response.status).toBe(code);
      expect(response.headers.get('x-response-time')).toMatch(/^\d+ms$/);
    }
    expect(getStats().count).toBe(4);
    expect(getStats().statusCodes).toEqual({ 401: 1, 500: 1, 404: 1, 400: 1 });
  });

  test('groups configured routes, including nested plugins', async () => {
    const stats = createStats({
      endpointStats: true,
      complexEndpoints: ['/user/:id'],
    });
    const { getStats } = stats;
    const app = new Elysia()
      .use(elysiaStats(stats))
      .use(new Elysia().get('/user/:id', ({ params }) => params.id));
    await send(app, '/user/one');
    await send(app, '/user/two?x=1');
    expect(getStats().endpointStats!['GET /user/:id'].count).toBe(2);
  });

  test('does not overwrite existing headers and disables optional output', async () => {
    const stats = createStats({ addHeader: true });
    const { getStats } = stats;
    const app = new Elysia()
      .use(elysiaStats(stats))
      .get(
        '/native',
        () => new Response('OK', { headers: { 'x-response-time': 'custom' } }),
      )
      .get('/set', ({ set }) => {
        set.headers['x-response-time'] = 'set';
        return 'OK';
      });
    expect((await send(app, '/native')).headers.get('x-response-time')).toBe(
      'custom',
    );
    expect((await send(app, '/set')).headers.get('x-response-time')).toBe(
      'set',
    );
    expect(getStats().endpointStats).toBeUndefined();
    expect(getStats().customStats).toBeUndefined();
    const plain = createStats();
    expect(
      (
        await send(new Elysia().use(elysiaStats(plain)).get('/', () => 'OK'))
      ).headers.has('x-response-time'),
    ).toBe(false);
  });

  test('keeps instances independent and excludes current stats response', async () => {
    const first = createStats();
    const second = createStats();
    const app = new Elysia()
      .use(elysiaStats(first))
      .get('/stats', () => first.getStats());
    const response = await app.handle(new Request('http://localhost/stats'));
    expect((await response.json()).count).toBe(0);
    expect(first.getStats().count).toBe(1);
    expect(second.getStats().count).toBe(0);
    expect(first.getStats().uuid).not.toBe(second.getStats().uuid);
  });

  test('tracks concurrent measurements and failure cleanup', async () => {
    const stats = createStats({ customStats: true });
    const measurements = [
      stats.startMeasurement('work'),
      stats.startMeasurement('work'),
    ];
    expect(stats.getStats().customStats!.work.started).toBe(2);
    expect(stats.getStats().customStats!.work.count).toBe(0);
    measurements.reverse().forEach(stats.finishMeasurement);
    const app = new Elysia().use(elysiaStats(stats)).get('/', () => {
      const measurement = stats.startMeasurement('work');
      try {
        throw new Error('Oops');
      } finally {
        stats.finishMeasurement(measurement);
      }
    });
    await send(app);
    expect(stats.getStats().customStats!.work.count).toBe(3);
    expect(stats.getStats().customStats!.work.totalTime).toBeGreaterThanOrEqual(
      0,
    );
    const unusual = stats.startMeasurement('__proto__');
    stats.finishMeasurement(unusual);
    expect(stats.getStats().customStats!['__proto__'].count).toBe(1);
  });

  test('keeps two installed collectors independent and deduplicates reuse', async () => {
    const first = createStats();
    const second = createStats({ endpointStats: true });
    const app = new Elysia()
      .use(elysiaStats(first))
      .use(elysiaStats(first))
      .use(elysiaStats(second))
      .use(new Elysia().use(elysiaStats(first)).get('/nested', () => 'OK'));
    await send(app, '/nested');
    expect(first.getStats().count).toBe(1);
    expect(second.getStats().count).toBe(1);
    expect(second.getStats().endpointStats!['GET /nested'].count).toBe(1);
  });

  test('does not wait for or buffer a streaming body', async () => {
    const stats = createStats({ addHeader: true });
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const app = new Elysia()
      .use(elysiaStats(stats))
      .get('/', () => new Response(body));
    const response = await app.handle(new Request('http://localhost/'));
    expect(stats.getStats().count).toBe(1);
    expect(response.headers.get('x-response-time')).toMatch(/^\d+ms$/);
    controller.enqueue(new TextEncoder().encode('one'));
    controller.enqueue(new TextEncoder().encode('two'));
    controller.close();
    expect(await response.text()).toBe('onetwo');
    expect(stats.getStats().count).toBe(1);
  });

  test('handles immutable headers without losing status or body', async () => {
    const stats = createStats({ addHeader: true });
    const app = new Elysia()
      .use(elysiaStats(stats))
      .get('/redirect', () => Response.redirect('https://example.com'))
      .get('/immutable', async () => fetch('data:text/plain,Hello'));
    const redirect = await app.handle(new Request('http://localhost/redirect'));
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('https://example.com/');
    expect(redirect.headers.get('x-response-time')).toMatch(/^\d+ms$/);
    const immutable = await app.handle(
      new Request('http://localhost/immutable'),
    );
    expect(await immutable.text()).toBe('Hello');
    expect(immutable.headers.get('content-type')).toContain('text/plain');
    expect(stats.getStats().statusCodes).toEqual({ 200: 1, 302: 1 });
  });

  test('counts schema failures, concurrent requests and final mapped statuses', async () => {
    const stats = createStats();
    const app = new Elysia()
      .use(elysiaStats(stats))
      .mapResponse(({ request }) => {
        if (new URL(request.url).pathname === '/mapped')
          return new Response('mapped', { status: 203 });
      })
      .get('/mapped', () => 'OK')
      .post('/schema', ({ body }) => body, {
        body: t.Object({ name: t.String() }),
      });
    const invalid = await send(app, '/schema', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":1}',
    });
    expect(invalid.status).toBe(422);
    await Promise.all(Array.from({ length: 20 }, () => send(app, '/mapped')));
    expect(stats.getStats().count).toBe(21);
    expect(stats.getStats().statusCodes).toEqual({ 203: 20, 422: 1 });
    app.get('/later', () => 'Later');
    await send(app, '/later');
    expect(stats.getStats().count).toBe(22);
  });

  test('works through a real Bun listener', async () => {
    const stats = createStats({ addHeader: true });
    const { getStats } = stats;
    const app = new Elysia()
      .use(elysiaStats(stats))
      .get('/', 'Hello')
      .use(new Elysia().get('/nested', () => 'Nested'))
      .listen({ hostname: '127.0.0.1', port: 0 });
    try {
      const response = await fetch(`http://127.0.0.1:${app.server!.port}/`);
      expect(await response.text()).toBe('Hello');
      expect(response.headers.get('x-response-time')).toMatch(/^\d+ms$/);
      const nested = await fetch(`http://127.0.0.1:${app.server!.port}/nested`);
      expect(await nested.text()).toBe('Nested');
      const missing = await fetch(
        `http://127.0.0.1:${app.server!.port}/missing`,
      );
      expect(missing.status).toBe(404);
      await missing.text();
      expect(getStats().count).toBe(3);
    } finally {
      await app.stop(true);
    }
  });
});
