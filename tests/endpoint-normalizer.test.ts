import { expect, test } from 'bun:test';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { createStats } from '../src/index.js';
import { fastifyStats } from '../src/fastify.js';
import { honoStats } from '../src/hono.js';

test('normalizes once before allocation across Node and Fetch adapters, preserving methods', async () => {
  const paths: string[] = [];
  const stats = createStats({
    endpointStats: true,
    endpointNormalizer: (pathname) => {
      paths.push(pathname);
      return pathname.endsWith('.php') ? '/*.php' : pathname;
    },
  });
  const node = Fastify().addHook('onRequest', fastifyStats(stats));
  const fetch = new Hono().use('*', honoStats(stats));
  try {
    for (let i = 0; i < 100; i++) {
      const path = `/bot-${i}/probe.php`;
      if (i % 2) await node.inject(`${path}?noise=${i}`);
      else await fetch.request(`http://example.test${path}?noise=${i}`);
    }
    await fetch.request('http://example.test/admin.php?secret=yes', {
      method: 'POST',
    });
    expect(paths).toEqual([
      ...Array.from({ length: 100 }, (_, i) => `/bot-${i}/probe.php`),
      '/admin.php',
    ]);
    const result = stats.getStats();
    expect(result.count).toBe(101);
    expect(Object.keys(result.endpointStats!)).toEqual([
      'GET /*.php',
      'POST /*.php',
    ]);
    expect(result.endpointStats!['GET /*.php'].count).toBe(100);
    expect(result.endpointStats!['POST /*.php'].count).toBe(1);
  } finally {
    await node.close();
  }
});

test('matches complexEndpoints against normalized paths in first-match order', async () => {
  const stats = createStats({
    endpointStats: true,
    endpointNormalizer: (pathname) => pathname.replace('/legacy/', '/user/'),
    complexEndpoints: ['/user/:id', '/user/*'],
  });
  const app = new Hono().use('*', honoStats(stats));
  await app.request('/legacy/123?query=yes');
  expect(Object.keys(stats.getStats().endpointStats!)).toEqual([
    'GET /user/:id',
  ]);
});

test('omitting normalizer preserves paths and existing grouping', async () => {
  const stats = createStats({
    endpointStats: true,
    complexEndpoints: ['/user/:id'],
  });
  const app = new Hono().use('*', honoStats(stats));
  for (const path of ['/a.php?q=1', '/b.php', '/user/123']) {
    await app.request(path);
  }
  expect(Object.keys(stats.getStats().endpointStats!)).toEqual([
    'GET /a.php',
    'GET /b.php',
    'GET /user/:id',
  ]);
});

test('disabled endpoint stats never invoke normalizer', async () => {
  let calls = 0;
  const stats = createStats({
    endpointNormalizer: (pathname) => {
      calls++;
      return pathname;
    },
  });
  const app = new Hono().use('*', honoStats(stats));
  await app.request('/probe.php?query=yes');
  expect(calls).toBe(0);
  expect(stats.getStats().count).toBe(1);
  expect(stats.getStats().endpointStats).toBeUndefined();
});
