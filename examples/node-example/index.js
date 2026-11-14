import { createServer } from 'node:http';
import { createStats } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
const stats = createStats({ endpointStats: true, addHeader: true });
const middleware = expressStats(stats);
createServer((req, res) =>
  middleware(req, res, () => {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(req.url === '/stats' ? stats.getStats() : { hello: true }),
    );
  }),
).listen(8080);
