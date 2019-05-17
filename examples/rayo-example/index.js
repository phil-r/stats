const rayo = require('rayo');
const initStats = require('../..');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});

rayo({ port: 8080 })
  .through(statsMiddleware)
  .get('/', (req, res) => res.end('Hello'))
  .get('/user/:id', (req, res) => res.end(`Hello ${req.params.id}`))
  .get('/long', async (req, res) => {
    const measurement = req.startMeasurement('long');
    await new Promise(resolve => {
      setTimeout(resolve, 2000);
    });
    req.finishMeasurement(measurement);
    res.end('Long job finished');
  })
  .get('/stats', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(getStats()));
  })
  .start();

console.log('Server listens at http://localhost:8080'); // eslint-disable-line no-console
