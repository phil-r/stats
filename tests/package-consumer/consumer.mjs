import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStats } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
// Every published entry must resolve and include its declarations, even when
// its optional peer (Elysia) is unavailable for a runtime import.
const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.resolve('@phil-r/stats'))),
  '..',
);
const { exports } = JSON.parse(
  readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
);
assert.deepEqual(Object.keys(exports).sort(), [
  '.',
  './elysia',
  './express',
  './fastify',
  './hono',
]);
for (const [subpath, entry] of Object.entries(exports)) {
  const name = '@phil-r/stats' + (subpath === '.' ? '' : subpath.slice(1));
  assert.ok(existsSync(fileURLToPath(import.meta.resolve(name))), name);
  assert.ok(existsSync(resolve(packageRoot, entry.types)), entry.types);
}
const stats = createStats();
assert.equal(typeof expressStats(stats), 'function');
const { fastifyStats } = await import('@phil-r/stats/fastify');
const { honoStats } = await import('@phil-r/stats/hono');
assert.equal(typeof fastifyStats(stats), 'function');
assert.equal(typeof honoStats(stats), 'function');
for (const peer of ['elysia', 'express', 'fastify', 'hono', '@nestjs/core']) {
  assert.throws(() => import.meta.resolve(peer), {
    code: 'ERR_MODULE_NOT_FOUND',
  });
}
