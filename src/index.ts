import { randomUUID as uuidv4 } from 'node:crypto';
import { parse } from 'regexparam';
import prettyTime from 'pretty-time';
import { hrTimeToMs } from './internal.js';
import { collectors } from './internal.js';
import type {
  StatsOptions,
  StatsCollector,
  Stats,
  EndpointStats,
  CustomStats,
  Measurement,
} from './types.js';
export type {
  StatsOptions,
  StatsCollector,
  Stats,
  Timing,
  EndpointStats,
  CustomStats,
  Measurement,
} from './types.js';

/**
 * Create an independent in-memory collector for one or more framework adapters.
 * Counters are unbounded and process-local; configure endpoint patterns to group
 * dynamic URLs. No endpoint is exposed automatically.
 * @param opts - Collection and response-header options, disabled by default.
 */
export function createStats(opts: StatsOptions = {}): StatsCollector {
  const active = new WeakSet<Measurement>();
  const stats = {
    uuid: uuidv4(),
    pid: process.pid,
    totalTime: 0,
    averageTime: 0,
    count: 0,
  };
  const statusCodes: Record<string, number> = {};
  const endpointStats: Record<string, EndpointStats> = {};
  const customStats: Record<string, CustomStats> = {};
  const complexEndpoints = (opts.complexEndpoints || []).map((path) => ({
    ...parse(path),
    path,
  }));

  function getStats() {
    const result: Stats = {
      uptime: process.uptime() * 1e3,
      uptimeHumanReadable: prettyTime(Math.floor(process.uptime() * 1e9)),
      statusCodes,
      ...stats,
    };
    if (opts.endpointStats) result.endpointStats = endpointStats;
    if (opts.customStats) result.customStats = customStats;
    return result;
  }

  function startMeasurement(name: string): Measurement {
    if (!Object.prototype.hasOwnProperty.call(customStats, name)) {
      // Define an own key so names such as __proto__ cannot mutate the map.
      Object.defineProperty(customStats, name, {
        value: { totalTime: 0, averageTime: 0, started: 0, count: 0 },
        enumerable: true,
      });
    }
    customStats[name].started++;
    const measurement = { start: process.hrtime(), name };
    active.add(measurement);
    return measurement;
  }

  function finishMeasurement(measurement: Measurement) {
    if (!active.has(measurement))
      throw new TypeError('Unknown or finished measurement');
    active.delete(measurement);
    const { name, start } = measurement;
    const time = hrTimeToMs(process.hrtime(start));
    customStats[name].totalTime += time;
    customStats[name].count++;
    customStats[name].averageTime =
      customStats[name].totalTime / customStats[name].count;
  }

  function record(method: string, url: string, status: number, time: number) {
    stats.totalTime += time;
    stats.count++;
    stats.averageTime = stats.totalTime / stats.count;
    statusCodes[status] = (statusCodes[status] || 0) + 1;
    if (!opts.endpointStats) return;

    // Node supplies an origin-form path; do not interpret //foo as a host.
    let path = url.startsWith('/')
      ? url.split(/[?#]/, 1)[0]
      : new URL(url, 'http://localhost').pathname;
    if (opts.endpointNormalizer) path = opts.endpointNormalizer(path);
    const complexPath = complexEndpoints.find((endpoint) =>
      endpoint.pattern.test(path),
    );
    path = complexPath ? complexPath.path : path;
    const endpoint = `${method} ${path}`;
    if (!endpointStats[endpoint]) {
      endpointStats[endpoint] = {
        totalTime: 0,
        averageTime: 0,
        count: 0,
        statusCodes: {},
      };
    }
    const stat = endpointStats[endpoint];
    stat.totalTime += time;
    stat.count++;
    stat.averageTime = stat.totalTime / stat.count;
    stat.statusCodes[status] = (stat.statusCodes[status] || 0) + 1;
  }

  const collector = { getStats, startMeasurement, finishMeasurement };
  collectors.set(collector, { record, addHeader: !!opts.addHeader });
  return collector;
}
