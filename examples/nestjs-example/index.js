import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Controller, Get, Module } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { createStats } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
import { fastifyStats } from '@phil-r/stats/fastify';
const stats = createStats({ endpointStats: true, addHeader: true });
// Programmatic decorators keep this example runnable as plain Node ESM.
class AppController {
  hello() {
    return 'Hello';
  }
  stats() {
    return stats.getStats();
  }
}
Controller()(AppController);
for (const [name, path] of [
  ['hello', '/'],
  ['stats', '/stats'],
]) {
  Get(path)(
    AppController.prototype,
    name,
    Object.getOwnPropertyDescriptor(AppController.prototype, name),
  );
}
class AppModule {}
Module({ controllers: [AppController] })(AppModule);
const fastify = process.argv.includes('--fastify');
const app = await NestFactory.create(
  AppModule,
  fastify ? new FastifyAdapter() : new ExpressAdapter(),
);
if (fastify)
  app.getHttpAdapter().getInstance().addHook('onRequest', fastifyStats(stats));
else app.use(expressStats(stats));
await app.listen(8080);
