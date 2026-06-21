// Frontend geofence + trip analysis (per-day processing).
//
// One pass over a day's time-ordered route points + the active geofences produces both the trip
// list and the geofence-aware halt filter. Shared by the Route History day view and Analytics.
//
// Domain model: across a day the vehicle is either INSIDE a geofence (a known visit/stop),
// or in TRANSIT (moving between geofences = a trip). A stationary stretch in transit is a
// suspicious halt; a stationary stretch inside a geofence is an expected visit (not a halt).

import type { Geofence } from "./api";
import { haversineMeters, type RoutePoint, type Halt } from "./routeAnalysis";

const KM = 1000;

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/** Ray-casting point-in-polygon over a GeoJSON ring of [lon, lat] pairs. */
function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Is the point inside this specific (active) geofence? */
export function isInsideGeofence(lat: number, lng: number, g: Geofence): boolean {
  if (g.is_active === false) return false;
  if (g.fence_type === "circle") {
    if (g.center_lat == null || g.center_lon == null || g.radius_meters == null) return false;
    return haversineMeters(g.center_lat, g.center_lon, lat, lng) <= g.radius_meters;
  }
  if (g.fence_type === "polygon" && Array.isArray(g.geometry)) {
    return pointInPolygon(lat, lng, g.geometry);
  }
  return false;
}

/** The first active geofence containing the point, or null. */
export function findGeofence(lat: number, lng: number, geofences: Geofence[]): Geofence | null {
  for (const g of geofences) {
    if (g.is_active !== false && isInsideGeofence(lat, lng, g)) return g;
  }
  return null;
}

export function isInsideAnyGeofence(lat: number, lng: number, geofences: Geofence[]): boolean {
  return findGeofence(lat, lng, geofences) !== null;
}

// ---------------------------------------------------------------------------
// Visits & trips
// ---------------------------------------------------------------------------

export interface Visit {
  geofenceId: number;
  geofenceName: string;
  enterTime: string;
  exitTime: string;
  enterPoint: RoutePoint;
  exitPoint: RoutePoint;
  durationMin: number;
}

export type TripStatus = "complete" | "open" | "ongoing";

export interface Trip {
  index: number;
  /** Geofence the trip started from, or null for "Open location" / start of day. */
  startFence: string | null;
  startTime: string;
  startLat: number;
  startLng: number;
  /** Geofence the trip ended at, or null for "Open location" / ongoing. */
  endFence: string | null;
  endTime: string;
  endLat: number;
  endLng: number;
  distanceKm: number;
  status: TripStatus;
  /** The trip's path as [lat, lng] points (for drawing the segment on a map). */
  path: [number, number][];
}

export interface TripOptions {
  /** Minimum minutes inside a fence to count as a confirmed visit. */
  minVisitDwellMin?: number;
  /** Absolute floor: drop any trip shorter than this (km). */
  minTripKm?: number;
  /**
   * GPS-jitter filter: a trip is dropped when it is BOTH short (< noiseMaxKm) AND slow
   * (avg speed < noiseMaxAvgKmh). This removes phantom "trips" caused by GPS drift while the
   * vehicle is parked in the open, without discarding genuine short-but-brisk trips.
   */
  noiseMaxKm?: number;
  noiseMaxAvgKmh?: number;
  /** Speed (km/h) at/under which a point counts as stationary (for open-air parking detection). */
  speedThreshold?: number;
  /** Minutes stationary in the open to treat a trailing transit as "parked" (trip end). */
  parkDwellMin?: number;
}

const TRIP_DEFAULTS: Required<TripOptions> = {
  minVisitDwellMin: 2,
  minTripKm: 0.1,
  noiseMaxKm: 1.0,
  noiseMaxAvgKmh: 3,
  speedThreshold: 2,
  parkDwellMin: 5,
};

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/** Confirmed visits: contiguous in-fence runs lasting >= minVisitDwellMin. */
export function detectVisits(
  points: RoutePoint[],
  geofences: Geofence[],
  options: TripOptions = {}
): Visit[] {
  const { minVisitDwellMin } = { ...TRIP_DEFAULTS, ...options };
  const valid = points.filter((p) => p.latitude != null && p.longitude != null);
  const visits: Visit[] = [];

  let runFence: Geofence | null = null;
  let run: RoutePoint[] = [];

  const flush = () => {
    if (runFence && run.length >= 2) {
      const durationMin = minutesBetween(run[0].received_at, run[run.length - 1].received_at);
      if (durationMin >= minVisitDwellMin) {
        visits.push({
          geofenceId: runFence.id,
          geofenceName: runFence.name,
          enterTime: run[0].received_at,
          exitTime: run[run.length - 1].received_at,
          enterPoint: run[0],
          exitPoint: run[run.length - 1],
          durationMin: Math.round(durationMin),
        });
      }
    }
    run = [];
    runFence = null;
  };

  for (const p of valid) {
    const g = findGeofence(p.latitude, p.longitude, geofences);
    if (g && runFence && g.id === runFence.id) {
      run.push(p);
    } else {
      flush();
      if (g) {
        runFence = g;
        run = [p];
      }
    }
  }
  flush();

  return visits;
}

/** Distance (km) summed along a slice of points. */
function pathKm(points: RoutePoint[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) {
    m += haversineMeters(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return m / KM;
}

/**
 * Derive trips from a day's points. A trip is the transit stretch between two confirmed visits,
 * plus leading/trailing open stretches. Points should be time-ordered ascending and may include a
 * look-behind/look-ahead margin (callers attribute each trip to its start point's IST date).
 */
export function detectTrips(
  points: RoutePoint[],
  geofences: Geofence[],
  options: TripOptions = {}
): Trip[] {
  const opts = { ...TRIP_DEFAULTS, ...options };
  const valid = points.filter((p) => p.latitude != null && p.longitude != null);
  if (valid.length < 2) return [];

  const visits = detectVisits(valid, geofences, opts);
  const trips: Trip[] = [];

  const timeOf = (p: RoutePoint) => new Date(p.received_at).getTime();
  const sliceBetween = (startT: number, endT: number) =>
    valid.filter((p) => timeOf(p) >= startT && timeOf(p) <= endT);

  const pushTrip = (
    startPoint: RoutePoint,
    endPoint: RoutePoint,
    startFence: string | null,
    endFence: string | null,
    status: TripStatus,
    stretch: RoutePoint[]
  ) => {
    const distanceKm = pathKm(stretch);
    if (distanceKm < opts.minTripKm) return;
    // Drop GPS-jitter phantoms: short AND slow.
    const durMin = minutesBetween(startPoint.received_at, endPoint.received_at);
    const avgKmh = durMin > 0 ? distanceKm / (durMin / 60) : 0;
    if (distanceKm < opts.noiseMaxKm && avgKmh < opts.noiseMaxAvgKmh) return;
    trips.push({
      index: trips.length + 1,
      startFence,
      startTime: startPoint.received_at,
      startLat: startPoint.latitude,
      startLng: startPoint.longitude,
      endFence,
      endTime: endPoint.received_at,
      endLat: endPoint.latitude,
      endLng: endPoint.longitude,
      distanceKm: Math.round(distanceKm * 100) / 100,
      status,
      path: stretch.map((p) => [p.latitude, p.longitude] as [number, number]),
    });
  };

  if (visits.length === 0) {
    // Whole window is one transit (vehicle never confirmed inside a fence).
    pushTrip(valid[0], valid[valid.length - 1], null, null, "open", valid);
    return trips;
  }

  // Leading transit: movement before the first visit.
  const first = visits[0];
  if (timeOf(first.enterPoint) > timeOf(valid[0])) {
    const stretch = sliceBetween(timeOf(valid[0]), timeOf(first.enterPoint));
    pushTrip(valid[0], first.enterPoint, null, first.geofenceName, "complete", stretch);
  }

  // Between consecutive visits.
  for (let i = 0; i < visits.length - 1; i++) {
    const a = visits[i];
    const b = visits[i + 1];
    const stretch = sliceBetween(timeOf(a.exitPoint), timeOf(b.enterPoint));
    pushTrip(a.exitPoint, b.enterPoint, a.geofenceName, b.geofenceName, "complete", stretch);
  }

  // Trailing transit after the last visit.
  const last = visits[visits.length - 1];
  if (timeOf(last.exitPoint) < timeOf(valid[valid.length - 1])) {
    const stretch = sliceBetween(timeOf(last.exitPoint), timeOf(valid[valid.length - 1]));
    const tail = stretch[stretch.length - 1];
    // Parked in the open if the stretch ends stationary for >= parkDwellMin.
    let parkStart = stretch.length - 1;
    while (
      parkStart > 0 &&
      (stretch[parkStart].speed ?? 0) <= opts.speedThreshold &&
      haversineMeters(tail.latitude, tail.longitude, stretch[parkStart].latitude, stretch[parkStart].longitude) <= 60
    ) {
      parkStart--;
    }
    const parkedMin = minutesBetween(stretch[Math.min(parkStart + 1, stretch.length - 1)].received_at, tail.received_at);
    const status: TripStatus = parkedMin >= opts.parkDwellMin ? "open" : "ongoing";
    pushTrip(last.exitPoint, tail, last.geofenceName, null, status, stretch);
  }

  return trips.map((t, i) => ({ ...t, index: i + 1 }));
}

// ---------------------------------------------------------------------------
// Halt filtering
// ---------------------------------------------------------------------------

/** Drop halts whose location is inside an active geofence (those are expected visits, not halts). */
export function filterHaltsOutsideGeofences(halts: Halt[], geofences: Geofence[]): Halt[] {
  if (!geofences.length) return halts;
  return halts.filter((h) => !isInsideAnyGeofence(h.lat, h.lng, geofences));
}
