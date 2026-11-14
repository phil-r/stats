import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { serve } from '@hono/node-server';
import { NestFactory } from '@nestjs/core';
import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Module,
  Param,
  ParseIntPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { createStats } from '../dist/index.js';
import { fastifyStats } from '../dist/fastify.js';
import { honoStats } from '../dist/hono.js';
import { expressStats } from '../dist/express.js';

const options = {
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  addHeader: true,
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function checkResponse(base, path, status, text, header) {
  const response = await fetch(base + path);
  assert.equal(response.status, status, path);
  if (header) assert.equal(response.headers.get('x-response-time'), header);
  else assert.match(response.headers.get('x-response-time'), /^\d+ms$/);
  if (text !== undefined) assert.equal(await response.text(), text);
  else await response.arrayBuffer();
}

test('Fastify native hooks: validation, errors, raw/staged headers, streams and scoped registration', async () => {
  const app = Fastify();
  const stats = createStats(options);
  const independent = createStats();
  app.addHook('onRequest', fastifyStats(stats));
  app.addHook('onRequest', fastifyStats(independent));
  app.addHook('onRequest', (req, reply, done) =>
    req.url === '/early' ? reply.code(401).send('early') : done(),
  );
  app.get('/user/:id', async (_req, reply) => {
    await delay(20);
    return reply.code(201).send('OK');
  });
  app.get('/header', (_req, reply) =>
    reply.header('X-Response-Time', 'staged').send('OK'),
  );
  app.get('/raw', (_req, reply) => {
    reply.hijack();
    reply.raw.writeHead(202, { 'X-Response-Time': 'raw' });
    reply.raw.end('OK');
  });
  app.get('/staged-raw', (_req, reply) => {
    reply.header('X-Response-Time', 'staged-raw');
    reply.hijack();
    reply.raw.end('OK');
  });
  app.get('/error', () => {
    throw new Error('oops');
  });
  app.get(
    '/validate',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['n'],
          properties: { n: { type: 'integer' } },
        },
      },
    },
    () => 'OK',
  );
  let finishStream;
  app.get('/stream', (_req, reply) => {
    reply.hijack();
    reply.raw.writeHead(203);
    reply.raw.write('one');
    finishStream = () => reply.raw.end('two');
  });
  const scoped = createStats();
  app.register(
    async (child) => {
      child.addHook('onRequest', fastifyStats(scoped));
      child.get('/inside', () => 'inside');
    },
    { prefix: '/scope' },
  );
  const base = await app.listen({ port: 0, host: '127.0.0.1' });
  try {
    await checkResponse(base, '/user/42?q=yes', 201, 'OK');
    await checkResponse(base, '/early', 401, 'early');
    await checkResponse(base, '/header', 200, 'OK', 'staged');
    await checkResponse(base, '/raw', 202, 'OK', 'raw');
    await checkResponse(base, '/staged-raw', 200, 'OK', 'staged-raw');
    await checkResponse(base, '/error', 500);
    await checkResponse(base, '/validate?n=no', 400);
    await checkResponse(base, '/missing', 404);
    await checkResponse(base, '/scope/inside', 200, 'inside');
    const response = await fetch(base + '/stream');
    assert.equal(stats.getStats().count, 10); // before stream completes
    finishStream();
    assert.equal(await response.text(), 'onetwo');
    assert.equal(stats.getStats().count, 10);
    assert.equal(independent.getStats().count, 10);
    assert.equal(scoped.getStats().count, 1);
    assert.equal(stats.getStats().endpointStats['GET /user/:id'].count, 1);
    assert.ok(stats.getStats().totalTime >= 15);
    assert.deepEqual(stats.getStats().statusCodes, {
      200: 3,
      201: 1,
      202: 1,
      203: 1,
      400: 1,
      401: 1,
      404: 1,
      500: 1,
    });
  } finally {
    finishStream?.();
    await app.close();
  }
});

test('Hono Fetch middleware on a Node listener: final responses, errors, immutable headers and streaming', async () => {
  const app = new Hono();
  const stats = createStats(options);
  const independent = createStats();
  app.use('*', honoStats(stats), honoStats(independent));
  app.use('/early', (c) => c.text('early', 401));
  app.get('/user/:id', async (c) => {
    await delay(20);
    return c.text('OK', 201);
  });
  app.get('/header', (c) => {
    c.header('X-Response-Time', 'staged');
    return c.text('OK');
  });
  app.get('/error', () => {
    throw new Error('oops');
  });
  app.onError((_err, c) => c.text('error', 503));
  app.get(
    '/validate',
    validator('query', (_value, c) => c.text('invalid', 400)),
    (c) => c.text('OK'),
  );
  app.get('/immutable', () => Response.redirect('http://example.com/'));
  let finishStream;
  app.get(
    '/stream',
    () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('one'));
            finishStream = () => {
              controller.enqueue(new TextEncoder().encode('two'));
              controller.close();
              finishStream = undefined;
            };
          },
        }),
        { status: 202, headers: { 'X-Keep': 'yes' } },
      ),
  );
  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
  if (!server.listening)
    await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await checkResponse(base, '/user/42?q=yes', 201, 'OK');
    await checkResponse(base, '/early', 401, 'early');
    await checkResponse(base, '/header', 200, 'OK', 'staged');
    await checkResponse(base, '/error', 503, 'error');
    await checkResponse(base, '/validate', 400, 'invalid');
    await checkResponse(base, '/missing', 404);
    const redirect = await fetch(base + '/immutable', { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), 'http://example.com/');
    assert.match(redirect.headers.get('x-response-time'), /^\d+ms$/);
    const response = await fetch(base + '/stream');
    assert.equal(response.headers.get('x-keep'), 'yes');
    assert.equal(stats.getStats().count, 8);
    finishStream();
    assert.equal(await response.text(), 'onetwo');
    assert.equal(stats.getStats().count, 8);
    assert.equal(independent.getStats().count, 8);
    assert.equal(stats.getStats().endpointStats['GET /user/:id'].count, 1);
    assert.ok(stats.getStats().totalTime >= 15);
    assert.deepEqual(stats.getStats().statusCodes, {
      200: 1,
      201: 1,
      202: 1,
      302: 1,
      400: 1,
      401: 1,
      404: 1,
      503: 1,
    });
  } finally {
    finishStream?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

// Programmatic decorators prove the actual Nest runtime without relying on a
// transpiler's decorator metadata or special compiler options.
let finishNestStream;
class TestController {
  async user() {
    await delay(20);
    return 'OK';
  }
  header() {
    return 'OK';
  }
  error() {
    throw new HttpException('unavailable', 503);
  }
  validate(n) {
    return String(n);
  }
  denied() {
    return 'unreachable';
  }
  stream() {
    const stream = new Readable({ read() {} });
    stream.push('one');
    finishNestStream = () => {
      stream.push('two');
      stream.push(null);
      finishNestStream = undefined;
    };
    return new StreamableFile(stream);
  }
}
Controller()(TestController);
for (const [method, path] of [
  ['user', 'user/:id'],
  ['header', 'header'],
  ['error', 'error'],
  ['validate', 'validate/:n'],
  ['stream', 'stream'],
  ['denied', 'denied'],
]) {
  Get(path)(
    TestController.prototype,
    method,
    Object.getOwnPropertyDescriptor(TestController.prototype, method),
  );
}
HttpCode(201)(
  TestController.prototype,
  'user',
  Object.getOwnPropertyDescriptor(TestController.prototype, 'user'),
);
Header('X-Response-Time', 'nest-custom')(
  TestController.prototype,
  'header',
  Object.getOwnPropertyDescriptor(TestController.prototype, 'header'),
);
UseGuards({ canActivate: () => false })(
  TestController.prototype,
  'denied',
  Object.getOwnPropertyDescriptor(TestController.prototype, 'denied'),
);
Param('n', new ParseIntPipe())(TestController.prototype, 'validate', 0);
class TestModule {}
Module({ controllers: [TestController] })(TestModule);

for (const platform of ['express', 'fastify']) {
  test(`NestJS ${platform}: bootstrapped routes, pipes, errors, headers, streams, prefix and 404s`, async () => {
    const adapter =
      platform === 'express' ? new ExpressAdapter() : new FastifyAdapter();
    const app = await NestFactory.create(TestModule, adapter, {
      logger: false,
    });
    const stats = createStats({
      ...options,
      complexEndpoints: ['/api/user/:id'],
    });
    const independent = createStats();
    if (platform === 'express') {
      app.use(expressStats(stats), expressStats(independent));
      app.use((req, res, next) =>
        req.url === '/early' ? res.status(401).send('early') : next(),
      );
    } else {
      const fastify = app.getHttpAdapter().getInstance();
      fastify.addHook('onRequest', fastifyStats(stats));
      fastify.addHook('onRequest', fastifyStats(independent));
      fastify.addHook('onRequest', (req, reply, done) =>
        req.url === '/early' ? reply.code(401).send('early') : done(),
      );
    }
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    try {
      const base = await app.getUrl();
      await checkResponse(base, '/api/user/42?q=yes', 201, 'OK');
      await checkResponse(base, '/api/header', 200, 'OK', 'nest-custom');
      await checkResponse(base, '/api/error', 503);
      await checkResponse(base, '/api/validate/no', 400);
      await checkResponse(base, '/missing', 404);
      await checkResponse(base, '/early', 401, 'early');
      await checkResponse(base, '/api/denied', 403);
      const response = await fetch(base + '/api/stream');
      assert.equal(stats.getStats().count, 8); // StreamableFile still open
      finishNestStream();
      assert.equal(await response.text(), 'onetwo');
      assert.equal(stats.getStats().count, 8);
      assert.equal(independent.getStats().count, 8);
      assert.equal(
        stats.getStats().endpointStats['GET /api/user/:id'].count,
        1,
      );
      assert.ok(stats.getStats().totalTime >= 15);
      assert.deepEqual(stats.getStats().statusCodes, {
        200: 2,
        201: 1,
        400: 1,
        401: 1,
        403: 1,
        404: 1,
        503: 1,
      });
    } finally {
      finishNestStream?.();
      await app.close();
    }
  });
}
