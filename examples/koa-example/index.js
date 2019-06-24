const Koa = require('koa');
const Router = require('koa-router');
const initStats = require('../..');

const app = new Koa();
const router = new Router();

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});

// Small modification is required to work with koa
const koaStatsMiddleware = (ctx, next) =>
  statsMiddleware(ctx.req, ctx.res, next);
koaStatsMiddleware._name = 'statsMiddleware';

router.get('/', ctx => (ctx.body = 'Hello'));
router.get('/user/:id', ctx => (ctx.body = `Hello ${ctx.params.id}`));
router.get('/long', async ctx => {
  const measurement = ctx.req.startMeasurement('long');
  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });
  ctx.req.finishMeasurement(measurement);
  ctx.body = 'Long job finished'; // eslint-disable-line require-atomic-updates
});
router.get('/stats', ctx => (ctx.body = getStats()));

app
  .use(koaStatsMiddleware)
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(8080);
console.log('Server listens at http://localhost:8080'); // eslint-disable-line no-console
