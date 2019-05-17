const http = require('http');
const initStats = require('../..');

const { statsMiddleware, getStats } = initStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true
});

http
  .createServer((req, res) => {
    statsMiddleware(req, res, async () => {
      if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(getStats()));
      }
      if (req.url.startsWith('/user/') && req.url.length > '/user/'.length) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(`Hello ${req.url.split('/user/')[1]}`);
      }
      const measurement = req.startMeasurement('long');
      await new Promise(resolve => {
        setTimeout(resolve, 2000);
      });
      req.finishMeasurement(measurement);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('🤖');
    });
  })
  .listen(8080);

console.log('Server listens at http://localhost:8080'); // eslint-disable-line no-console
