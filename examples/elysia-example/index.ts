import { Elysia } from 'elysia';
import { createStats } from '@phil-r/stats';
import { elysiaStats } from '@phil-r/stats/elysia';
const stats = createStats({
  endpointStats: true,
  customStats: true,
  addHeader: true,
});
new Elysia()
  .use(elysiaStats(stats))
  .get('/', () => 'Hello')
  .get('/stats', () => stats.getStats())
  .listen(8080);
