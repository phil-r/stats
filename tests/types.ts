import { Elysia } from 'elysia';
import express from 'express';
import { createStats } from '../src/index.js';
import { elysiaStats } from '../src/elysia.js';
import { expressStats } from '../src/express.js';
const stats = createStats({ endpointStats: true, customStats: true });
new Elysia().use(elysiaStats(stats));
express().use(expressStats(stats));
stats.finishMeasurement(stats.startMeasurement('work'));
// @ts-expect-error invalid option
createStats({ addHeader: 'yes' });
// @ts-expect-error missing start
stats.finishMeasurement({ name: 'work' });
// @ts-expect-error adapters accept collectors, not options
elysiaStats({ addHeader: true });

import Fastify from 'fastify';
import { Hono } from 'hono';
import { fastifyStats } from '../src/fastify.js';
import { honoStats } from '../src/hono.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
Fastify().addHook('onRequest', fastifyStats(stats));
new Hono<{ Variables: { user: string } }>().use('*', honoStats(stats));
async function nestTypes(module: Parameters<typeof NestFactory.create>[0]) {
  const expressApp = await NestFactory.create<NestExpressApplication>(module);
  expressApp.use(expressStats(stats));
  const fastifyApp = await NestFactory.create<NestFastifyApplication>(
    module,
    new FastifyAdapter(),
  );
  fastifyApp
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', fastifyStats(stats));
}
// @ts-expect-error adapters require a collector
fastifyStats({ addHeader: true });
// @ts-expect-error adapters require a collector
honoStats({ addHeader: true });
