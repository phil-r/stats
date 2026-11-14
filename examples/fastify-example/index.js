import Fastify from 'fastify';
import { createStats } from '@phil-r/stats';
import { fastifyStats } from '@phil-r/stats/fastify';
const stats = createStats({ endpointStats: true, addHeader: true });
const app = Fastify();
app.addHook('onRequest', fastifyStats(stats));
app.get('/', () => 'Hello');
app.get('/stats', () => stats.getStats());
await app.listen({ port: 8080 });
