const fastify = require('fastify')();
const initStats = require('../..');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});

/*
We can't use `fastify.use(statsMiddleware)` here, see https://www.fastify.io/docs/latest/Middlewares/

> Fastify wraps the incoming req and res Node instances using the Request and
> Reply objects internally, but this is done after the middlewares phase.
*/
fastify.addHook('preHandler', statsMiddleware);

fastify.get('/', (req, res) => res.send('Hello'));
fastify.get('/user/:id', (req, res) => res.send(`Hello ${req.params.id}`));
fastify.get('/long', async (req, res) => {
  const measurement = req.startMeasurement('long');
  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });
  req.finishMeasurement(measurement);
  res.send('Long job finished');
});
fastify.get('/stats', (req, res) => res.send(getStats()));

fastify.listen(8080);
console.log('Server listens at http://localhost:8080'); // eslint-disable-line no-console
