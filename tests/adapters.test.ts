import { test, expect } from 'bun:test';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { createStats } from '../src/index.js';
import { fastifyStats } from '../src/fastify.js';
import { honoStats } from '../src/hono.js';

test('Fastify injection counts final statuses without enabling headers', async () => {
  const app = Fastify();
  const stats = createStats({ endpointStats: true });
  app.addHook('onRequest', fastifyStats(stats));
  app.get('/ok', (_req, reply) => reply.code(202).send('OK'));
  try {
    const response = await app.inject('/ok?q=1');
    expect(response.statusCode).toBe(202);
    expect(response.headers['x-response-time']).toBeUndefined();
    expect(stats.getStats().endpointStats?.['GET /ok'].count).toBe(1);
    await app.inject('/missing');
    expect(stats.getStats().statusCodes).toEqual({ 202: 1, 404: 1 });
  } finally {
    await app.close();
  }
});

test('Hono native Fetch: downstream finalization, subapps, response headers and disabled headers', async () => {
  const stats = createStats({ endpointStats: true, addHeader: true });
  const app = new Hono().use('*', honoStats(stats));
  app.use('*', async (c, next) => {
    await next();
    c.res = new Response(c.res.body, { status: 202, headers: c.res.headers });
  });
  const child = new Hono().get('/ok', (c) =>
    c.text('OK', 201, { 'X-Response-Time': 'custom', 'X-Keep': 'yes' }),
  );
  app.route('/child', child);
  const response = await app.request('/child/ok?q=1');
  expect(response.status).toBe(202);
  expect(response.headers.get('x-response-time')).toBe('custom');
  expect(response.headers.get('x-keep')).toBe('yes');
  expect(await response.text()).toBe('OK');
  expect(stats.getStats().endpointStats?.['GET /child/ok'].statusCodes).toEqual(
    { 202: 1 },
  );

  const disabled = createStats();
  const plain = new Hono()
    .use('*', honoStats(disabled))
    .get('/', (c) => c.text('OK'));
  expect((await plain.request('/')).headers.has('x-response-time')).toBe(false);
  expect(disabled.getStats().count).toBe(1);
});
