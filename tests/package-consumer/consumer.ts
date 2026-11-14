import { createStats, type StatsCollector } from '@phil-r/stats';
import { expressStats } from '@phil-r/stats/express';
const stats: StatsCollector = createStats({ customStats: true });
stats.finishMeasurement(stats.startMeasurement('work'));
expressStats(stats);
// @ts-expect-error invalid option
createStats({ addHeader: 'yes' });
