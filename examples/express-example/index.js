const app = require('express')();
const initStats = require('../..');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});

app.use(statsMiddleware);
app.get('/', (req, res) => res.end('Hello'));
app.get('/user/:id', (req, res) => res.end(`Hello ${req.params.id}`));
app.get('/long', async (req, res) => {
  const measurement = req.startMeasurement('long');
  await new Promise(resolve => {
    setTimeout(resolve, 2000);
  });
  req.finishMeasurement(measurement);
  res.end('Long job finished');
});
app.get('/stats', (req, res) => res.send(getStats()));

app.listen(8080);
console.log('Server listens at http://localhost:8080'); // eslint-disable-line no-console
