const test = require('ava');
const request = require('supertest');

const http = require('http');

const initStats = require('.');
const { hrTimeToMs } = require('./utils');

test('initMiddleware returns getStats and statsMiddleware', t => {
  const { getStats, statsMiddleware } = initStats();
  t.is(typeof getStats, 'function');
  t.is(typeof statsMiddleware, 'function');
});

test('getStats returns a correct object', t => {
  const { getStats } = initStats();
  const stats = getStats();
  t.is(typeof stats.uptime, 'number');
  t.assert(stats.uptime > 0);
  t.is(typeof stats.uptimeHumanReadable, 'string');
  t.deepEqual(stats.statusCodes, {});
  t.is(typeof stats.uuid, 'string');
  t.is(typeof stats.pid, 'number');
  t.is(stats.totalTime, 0);
  t.is(stats.averageTime, 0);
  t.is(stats.count, 0);
  // endpointStats and customStats weren't set
  t.is(typeof stats.endpointStats, 'undefined');
  t.is(typeof stats.customStats, 'undefined');
});

test('statsMiddleware works', async t => {
  const { getStats, statsMiddleware } = initStats();
  const server = createServer(statsMiddleware);

  await request(server).get('/');

  let stats = getStats();
  t.is(stats.count, 1);
  t.assert(stats.totalTime > 0);
  t.assert(stats.averageTime > 0);
  t.is(stats.averageTime, stats.totalTime);
  t.deepEqual(stats.statusCodes, { 200: 1 });

  await request(server).get('/');

  stats = getStats();
  t.is(stats.count, 2);
  t.assert(stats.totalTime > 0);
  t.assert(stats.averageTime > 0);
  t.assert(stats.averageTime < stats.totalTime);
  t.deepEqual(stats.statusCodes, { 200: 2 });
});

test('endpointStats option works', async t => {
  const { getStats, statsMiddleware } = initStats({ endpointStats: true });
  const server = createServer(statsMiddleware);

  await request(server).get('/');

  let stats = getStats();
  let endpointStat = stats.endpointStats['GET /'];
  t.assert(endpointStat);
  t.is(endpointStat.count, 1);
  t.assert(endpointStat.totalTime > 0);
  t.assert(endpointStat.averageTime > 0);
  t.is(endpointStat.averageTime, endpointStat.totalTime);
  t.deepEqual(endpointStat.statusCodes, { 200: 1 });

  await request(server).post('/comment');

  stats = getStats();
  endpointStat = stats.endpointStats['POST /comment'];
  t.assert(endpointStat);
  t.is(endpointStat.count, 1);
  t.assert(endpointStat.totalTime > 0);
  t.assert(endpointStat.averageTime > 0);
  t.deepEqual(endpointStat.statusCodes, { 200: 1 });
});

test('complexEndpoints option works', async t => {
  const { getStats, statsMiddleware } = initStats({
    endpointStats: true,
    complexEndpoints: ['/user/:id']
  });
  const server = createServer(statsMiddleware);

  await request(server).get('/user/phil');
  await request(server).get('/user/herby');
  await request(server).get('/user'); // <- shouldn't be counted
  await request(server).get('/user/'); // <- shouldn't be counted

  const stats = getStats();
  const endpointStat = stats.endpointStats['GET /user/:id'];
  t.assert(endpointStat);
  t.is(endpointStat.count, 2);
  t.assert(endpointStat.totalTime > 0);
  t.assert(endpointStat.averageTime > 0);
  t.deepEqual(endpointStat.statusCodes, { 200: 2 });
});

test('customStats option works', t => {
  const { getStats, statsMiddleware } = initStats({ customStats: true });
  const req = {};
  statsMiddleware(req, {}, () => {});
  t.assert(req.startMeasurement);
  t.assert(req.finishMeasurement);

  const m1 = req.startMeasurement('test');
  req.finishMeasurement(m1);
  let stats = getStats();
  let customStat = stats.customStats['test'];
  t.assert(customStat);
  t.is(customStat.started, 1);
  t.is(customStat.count, 1);
  t.assert(customStat.totalTime > 0);
  t.assert(customStat.averageTime > 0);

  const m2 = req.startMeasurement('test');
  req.finishMeasurement(m2);
  stats = getStats();
  customStat = stats.customStats['test'];
  t.is(customStat.started, 2);
  t.is(customStat.count, 2);

  req.startMeasurement('test');
  stats = getStats();
  customStat = stats.customStats['test'];
  t.is(customStat.started, 3);
  t.is(customStat.count, 2);
});

test('addHeader option works', async t => {
  const { statsMiddleware } = initStats({ addHeader: true });
  const server = createServer(statsMiddleware);

  const res = await request(server).get('/');

  t.assert(res.headers['x-response-time'].includes('ms'));
});

test('utils.hrTimeToMs works correctly', t => {
  t.is(hrTimeToMs([0, 0]), 0);
  t.is(hrTimeToMs([1, 0]), 1000); // 1st argument is a second 1s = 1000ms
  t.is(hrTimeToMs([0, 1]), 1e-6); // 2nd argument is a nanosecond 1ns = 1e-6ms
  t.is(hrTimeToMs([1, 1]), 1000 + 1e-6);
  t.is(hrTimeToMs([2, 2]), 2000 + 2e-6);
});

function createServer(statsMiddleware) {
  return http.createServer((req, res) => {
    statsMiddleware(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('👍');
    });
  });
}
