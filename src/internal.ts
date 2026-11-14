import type { StatsCollector } from './types.js';
export const collectors = new WeakMap<
  StatsCollector,
  {
    addHeader: boolean;
    record(method: string, url: string, status: number, time: number): void;
  }
>();
export function getCollector(stats: StatsCollector) {
  const state = collectors.get(stats);
  if (!state) throw new TypeError('Expected a collector from createStats()');
  return state;
}
export function hrTimeToMs([s, ns]: [number, number]) {
  return s * 1e3 + ns * 1e-6;
}
