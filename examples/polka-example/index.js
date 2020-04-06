const polka = require('polka');
const send = require('@polka/send-type');
const initStats = require('../..');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true,
});

polka()
  .use(statsMiddleware)
  .get('/', (req, res) => send(res, 200, 'Hello'))
  .get('/user/:id', (req, res) => send(res, 200, `Hello ${req.params.id}`))
  .get('/long', async (req, res) => {
    const measurement = req.startMeasurement('long');
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
    req.finishMeasurement(measurement);
    send(res, 200, 'Long job finished');
  })
  .get('/stats', (req, res) => send(res, 200, getStats()))
  .listen(8080);

console.log('Server listens at http://localhost:8080'); // eslint-disable-line no-console
