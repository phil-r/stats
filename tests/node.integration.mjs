import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, get } from 'node:http';
import express from 'express';
import { createStats } from '../dist/index.js';
import { expressStats } from '../dist/express.js';

async function serve(handler, run) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}

test('Express: final statuses, grouped original URLs, errors, headers and timings', async () => {
  const stats = createStats({
    endpointStats: true,
    customStats: true,
    addHeader: true,
  });
  const independent = createStats();
  const app = express();
  app.use(expressStats(stats), expressStats(independent));
  const router = express.Router();
  router.get('/:id', async (_req, res) => {
    const m = stats.startMeasurement('work');
    try {
      await new Promise((resolve) => setTimeout(resolve, 25));
    } finally {
      stats.finishMeasurement(m);
    }
    res.status(201).send('OK');
  });
  app.use('/user', router);
  app.get('/header', (_req, res) =>
    res.set('X-Response-Time', 'custom').send('OK'),
  );
  app.get('/error', () => {
    throw new Error('Oops');
  });
  app.use((err, req, res, next) => res.status(503).send(err.message));
  // Grouping is configured on a separate collector in the Node HTTP test.
  await serve(app, async (url) => {
    assert.equal((await fetch(`${url}/user/one?x=1`)).status, 201);
    const header = await fetch(`${url}/header`);
    assert.equal(header.headers.get('x-response-time'), 'custom');
    assert.equal((await fetch(`${url}/error`)).status, 503);
    assert.equal((await fetch(`${url}/missing`)).status, 404);
  });
  const result = stats.getStats();
  assert.equal(result.count, 4);
  assert.deepEqual(result.statusCodes, { 201: 1, 200: 1, 503: 1, 404: 1 });
  assert.equal(result.endpointStats['GET /user/one'].count, 1);
  assert.ok(result.customStats.work.totalTime >= 20);
  assert.ok(result.totalTime >= 20);
  assert.equal(result.averageTime, result.totalTime / 4);
  assert.equal(independent.getStats().count, 4);
  assert.equal(independent.getStats().customStats, undefined);
});

test('origin-form paths retain leading double slashes', async () => {
  const stats = createStats({ endpointStats: true });
  const middleware = expressStats(stats);
  await serve(
    (req, res) => middleware(req, res, () => res.end('OK')),
    (url) =>
      new Promise((resolve, reject) => {
        get(`${url}/`, { path: '//foo?x=1' }, (res) => {
          res.resume();
          res.on('end', resolve);
          res.on('error', reject);
        }).on('error', reject);
      }),
  );
  assert.equal(stats.getStats().endpointStats['GET //foo'].count, 1);
});

test('plain Node middleware counts once at headers, not streaming completion', async () => {
  const stats = createStats({
    endpointStats: true,
    complexEndpoints: ['/user/:id'],
    addHeader: true,
  });
  const middleware = expressStats(stats);
  await serve(
    (req, res) =>
      middleware(req, res, () => {
        assert.equal(req.startMeasurement, undefined);
        res.writeHead(202);
        res.write('one');
        assert.equal(stats.getStats().count, 1);
        setTimeout(() => res.end('two'), 25);
      }),
    async (url) => {
      const response = await fetch(`${url}/user/123?query=yes`);
      assert.match(response.headers.get('x-response-time'), /^\d+ms$/);
      assert.equal(await response.text(), 'onetwo');
    },
  );
  assert.equal(stats.getStats().count, 1);
  assert.equal(stats.getStats().endpointStats['GET /user/:id'].count, 1);
});
