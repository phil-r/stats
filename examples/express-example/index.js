import express from 'express';
import { createStats } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
const stats = createStats({
  endpointStats: true,
  complexEndpoints: ['/user/:id'],
  customStats: true,
  addHeader: true,
});
const app = express();
app.use(expressStats(stats));
app.get('/user/:id', (req, res) => res.send(`Hello ${req.params.id}`));
app.get('/long', async (_req, res) => {
  const measurement = stats.startMeasurement('long');
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    stats.finishMeasurement(measurement);
  }
  res.send('Done');
});
app.get('/stats', (_req, res) => res.json(stats.getStats()));
app.listen(8080);
