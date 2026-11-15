import { expect, spyOn, test } from 'bun:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createStats } from '../src/index.js';
import { Elysia } from 'elysia';
import { elysiaStats } from '../src/elysia.js';

test.each([
  [0.000125, '125μs'],
  [0.125, '125ms'],
  [1.999, '2s'],
  [42, '42s'],
  [60, '1m 0s'],
  [3599, '59m 59s'],
  [3600, '1h 0s'],
  [5725, '1h 35m 25s'],
  [86400, '1d 0s'],
  [90061, '1d 1h 1m 1s'],
  [604799, '6d 23h 59m 59s'],
  [604800, '7d 0s'],
  [604801, '7d 1s'],
  [691200, '8d 0s'],
  [694925, '8d 1h 2m 5s'],
  [31536000, '365d 0s'],
])('formats process uptime %s as %s', (seconds, formatted) => {
  const uptime = spyOn(process, 'uptime').mockReturnValue(seconds);
  try {
    const result = createStats().getStats();
    expect(result.uptime).toBe(seconds * 1e3);
    expect(result.uptimeHumanReadable).toBe(formatted);
    expect(uptime).toHaveBeenCalledTimes(1);
  } finally {
    uptime.mockRestore();
  }
});

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
