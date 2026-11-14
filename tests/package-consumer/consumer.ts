import { createStats, type StatsCollector } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
const stats: StatsCollector = createStats({
  customStats: true,
  endpointStats: true,
  endpointNormalizer: (pathname) =>
    pathname.endsWith('.php') ? '/*.php' : pathname,
});
// @ts-expect-error normalizer must return a string
createStats({ endpointNormalizer: (pathname) => pathname.length });
createStats({
  // @ts-expect-error normalizer receives only a pathname, not a required method
  endpointNormalizer: (pathname: string, method: string) => pathname,
});
stats.finishMeasurement(stats.startMeasurement('work'));
expressStats(stats);
// @ts-expect-error invalid option
createStats({ addHeader: 'yes' });
