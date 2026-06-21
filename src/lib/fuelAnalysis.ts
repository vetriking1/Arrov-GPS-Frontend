// Frontend fuel analysis (on-demand, no ingest/schema changes).
//
// Two jobs:
//  1. Clean the raw fuel series — drop invalid voltage readings (0V no-signal, ~28V sensor error).
//  2. Detect fuel "triggers" (sudden refuel / drop) while ignoring the spikes caused by vehicle
//     shake (fuel sloshing). Shake produces a brief spike that immediately reverts; a real event is
//     a change that *persists* over a duration. We defend against it twice: a rolling median to
//     kill single-sample spikes, then a persistence requirement before emitting an event.

export interface FuelReading {
  received_at: string;
  voltage: number | string | null;
  fuel_level: number | string | null;
}

export interface FuelPoint {
  time: string; // ISO (UTC)
  level: number; // fuel percentage 0..100
}

export type FuelEventType = "refuel" | "drop";

export interface FuelEvent {
  type: FuelEventType;
  startTime: string;
  endTime: string;
  fromLevel: number; // %
  toLevel: number; // %
  deltaLevel: number; // signed %, + for refuel
}

// Valid fuel-sensor voltage range (mirrors the backend filter in routes/fuel.js).
export const MAX_VALID_VOLTAGE = 5.5;
export function isValidVoltage(v: number): boolean {
  return Number.isFinite(v) && v > 0 && v <= MAX_VALID_VOLTAGE;
}

/** Drop invalid-voltage readings and return a time-ordered {time, level%} series. */
export function cleanFuelSeries(readings: FuelReading[]): FuelPoint[] {
  return readings
    .filter((r) => r.voltage != null && isValidVoltage(Number(r.voltage)))
    .map((r) => ({ time: r.received_at, level: Number(r.fuel_level) }))
    .filter((p) => Number.isFinite(p.level))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Rolling median over a +/- (windowMin/2) time window — robust to shake spikes. */
export function rollingMedian(points: FuelPoint[], windowMin: number): FuelPoint[] {
  const halfMs = (windowMin / 2) * 60000;
  const times = points.map((p) => new Date(p.time).getTime());
  return points.map((p, i) => {
    const t = times[i];
    const window: number[] = [];
    for (let j = 0; j < points.length; j++) {
      if (Math.abs(times[j] - t) <= halfMs) window.push(points[j].level);
    }
    return { time: p.time, level: median(window) };
  });
}

export interface FuelEventOptions {
  /** Minimum sustained level change (percentage points) to count as an event. */
  thresholdPct?: number;
  /** The change must persist at least this long (minutes) — filters shake spikes. */
  persistMin?: number;
  /** Rolling-median smoothing window (minutes). */
  windowMin?: number;
}

const EVENT_DEFAULTS: Required<FuelEventOptions> = {
  thresholdPct: 5,
  persistMin: 3,
  windowMin: 3,
};

/**
 * Detect refuel (sudden rise) and drop (sudden fall) events from a cleaned fuel series.
 * Gradual consumption does not trigger (the baseline tracks slow drift); only sustained step
 * changes above the threshold do.
 */
export function detectFuelEvents(points: FuelPoint[], options: FuelEventOptions = {}): FuelEvent[] {
  const { thresholdPct, persistMin, windowMin } = { ...EVENT_DEFAULTS, ...options };
  if (points.length < 3) return [];

  const sm = rollingMedian(points, windowMin);
  const t = (s: string) => new Date(s).getTime();
  const events: FuelEvent[] = [];

  let stable = sm[0].level;
  let candidate: { startTime: string; fromLevel: number; dir: FuelEventType } | null = null;

  for (let k = 1; k < sm.length; k++) {
    const cur = sm[k];
    const diff = cur.level - stable;

    if (Math.abs(diff) >= thresholdPct) {
      const dir: FuelEventType = diff > 0 ? "refuel" : "drop";
      if (!candidate || candidate.dir !== dir) {
        candidate = { startTime: sm[k - 1].time, fromLevel: stable, dir };
      }
      // Persistence: only emit once the change has held for persistMin.
      if (t(cur.time) - t(candidate.startTime) >= persistMin * 60000) {
        events.push({
          type: dir,
          startTime: candidate.startTime,
          endTime: cur.time,
          fromLevel: Math.round(candidate.fromLevel * 10) / 10,
          toLevel: Math.round(cur.level * 10) / 10,
          deltaLevel: Math.round((cur.level - candidate.fromLevel) * 10) / 10,
        });
        stable = cur.level;
        candidate = null;
      }
    } else {
      // Within threshold → not (or no longer) an event: reset and let the baseline drift slowly.
      candidate = null;
      stable = cur.level;
    }
  }

  return events;
}
