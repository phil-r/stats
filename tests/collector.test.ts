import { expect, test } from 'bun:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createStats } from '../src/index.js';
import { Elysia } from 'elysia';
import { elysiaStats } from '../src/elysia.js';

test('positive elapsed request and custom timings in milliseconds', async () => {
  const stats = createStats({ customStats: true, endpointStats: true });
  const measurement = stats.startMeasurement('work');
  const app = new Elysia().use(elysiaStats(stats)).get('/', async () => {
    await delay(25);
    return 'OK';
  });
  await app.handle(new Request('http://localhost/'));
  stats.finishMeasurement(measurement);
  const result = stats.getStats();
  expect(result.totalTime).toBeGreaterThanOrEqual(20);
  expect(result.customStats!.work.totalTime).toBeGreaterThanOrEqual(20);
  expect(result.endpointStats!['GET /'].averageTime).toBe(result.totalTime);
  expect(result.uptime).toBeGreaterThan(0);
  expect(result.uptimeHumanReadable).toBeString();
  expect(() => stats.finishMeasurement(measurement)).toThrow(TypeError);
  expect(() =>
    createStats().finishMeasurement(stats.startMeasurement('other')),
  ).toThrow(TypeError);
});
