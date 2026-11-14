/** Collection features; every option defaults to false or an empty list. */
export interface StatsOptions {
  /** Include counters keyed by HTTP method and path, excluding query strings. */
  endpointStats?: boolean;
  /** Ordered regexparam patterns; first match groups dynamic URLs. Requires endpointStats. */
  complexEndpoints?: string[];
  /** Include custom measurements in getStats(); measurement methods always work. */
  customStats?: boolean;
  /** Add X-Response-Time in milliseconds unless the response already has it. */
  addHeader?: boolean;
}
/** Token owned by its originating collector; pass it unchanged to finishMeasurement. */
export interface Measurement {
  /** Monotonic start time, not a wall-clock timestamp. */
  readonly start: [number, number];
  /** Name used to aggregate this measurement. */
  readonly name: string;
}
/** Completed request or custom measurement totals. All times are milliseconds. */
export interface Timing {
  /** Sum of completed durations in milliseconds. */
  totalTime: number;
  /** totalTime / count, or zero before completion. */
  averageTime: number;
  /** Number of completed requests or measurements. */
  count: number;
}
/** Request totals for a single method/path group. */
export interface EndpointStats extends Timing {
  /** Counts keyed by final HTTP status code. */
  statusCodes: Record<string, number>;
}
/** Totals for a named custom measurement, including unfinished starts. */
export interface CustomStats extends Timing {
  /** Number of starts, including measurements not yet finished. */
  started: number;
}
/** Collector totals; nested maps are live and should be treated as read-only. */
export interface Stats extends Timing {
  /** Unique collector identity, also used for Elysia plugin deduplication. */
  uuid: string;
  /** ID of the hosting process. */
  pid: number;
  /** Process uptime in milliseconds, not collector age. */
  uptime: number;
  /** Human-readable process uptime. */
  uptimeHumanReadable: string;
  /** Request counts keyed by final HTTP status code. */
  statusCodes: Record<string, number>;
  /** Method/path totals, present only when endpointStats is enabled. */
  endpointStats?: Record<string, EndpointStats>;
  /** Named measurement totals, present only when customStats is enabled. */
  customStats?: Record<string, CustomStats>;
}
/** Independent collector that can be shared across framework adapters. */
export interface StatsCollector {
  /** Return current totals with live nested maps; clone for a durable snapshot. */
  getStats(): Stats;
  /** Start a named monotonic timing; overlapping measurements are supported. */
  startMeasurement(name: string): Measurement;
  /**
   * Finish a token exactly once on its originating collector and update totals.
   * @throws TypeError - If the token is unknown or already finished.
   */
  finishMeasurement(measurement: Measurement): void;
}
