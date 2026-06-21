// Frontend route analysis helpers (Route History page).
//
// Halt detection: a "halt" is a stretch where the vehicle stayed effectively stationary for
// longer than a minimum dwell time. We compute it from the route points already fetched for the
// map, so no extra API calls are needed.

export interface RoutePoint {
  latitude: number;
  longitude: number;
  speed: number;
  course?: number;
  satellites?: number;
  timestamp?: string;
  received_at: string;
}

export interface Halt {
  /** Representative (averaged) location of the halt. */
  lat: number;
  lng: number;
  /** UTC ISO timestamps. */
  startTime: string;
  endTime: string;
  durationMin: number;
  pointCount: number;
}

export interface HaltOptions {
  /** Containment radius (meters): the vehicle must stay within this of the cluster centroid. */
  radiusMeters?: number;
  /** Minimum dwell time (minutes) for a stay to count as a halt. */
  minDwellMin?: number;
  /**
   * Exit grace (seconds): a brief excursion outside the radius that returns within this window is
   * treated as GPS jitter (a spike/outlier) and absorbed, rather than ending the halt. Only a
   * sustained departure longer than this actually closes the halt.
   */
  exitGraceSec?: number;
}

const DEFAULTS: Required<HaltOptions> = {
  radiusMeters: 50,
  minDwellMin: 5,
  exitGraceSec: 90,
};

/** Haversine distance in meters between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

/**
 * Detect halts from a time-ordered list of route points.
 *
 * A halt is defined spatially: the vehicle stays within `radiusMeters` of a running centroid for
 * at least `minDwellMin`. This is robust to GPS signal errors:
 *  - per-point speed noise is ignored (we don't gate on speed);
 *  - position drift within the radius is absorbed by the centroid;
 *  - a brief excursion outside the radius that returns within `exitGraceSec` (a GPS spike /
 *    teleport outlier) is treated as jitter and does not split the halt.
 *
 * Points should be sorted ascending by received_at.
 */
export function detectHalts(points: RoutePoint[], options: HaltOptions = {}): Halt[] {
  const { radiusMeters, minDwellMin, exitGraceSec } = { ...DEFAULTS, ...options };
  const valid = points.filter((p) => p.latitude != null && p.longitude != null);
  const halts: Halt[] = [];
  const time = (p: RoutePoint) => new Date(p.received_at).getTime();

  let i = 0;
  const n = valid.length;

  while (i < n) {
    // Seed a new cluster at i with a running centroid.
    let sumLat = valid[i].latitude;
    let sumLng = valid[i].longitude;
    let count = 1;
    let cLat = sumLat;
    let cLng = sumLng;
    const startIdx = i;
    let lastInsideIdx = i;

    let j = i + 1;
    while (j < n) {
      const p = valid[j];
      const d = haversineMeters(cLat, cLng, p.latitude, p.longitude);
      if (d <= radiusMeters) {
        // Inside (or returned within the grace window) → absorb into the cluster.
        sumLat += p.latitude;
        sumLng += p.longitude;
        count += 1;
        cLat = sumLat / count;
        cLng = sumLng / count;
        lastInsideIdx = j;
        j++;
      } else {
        // Outside: tolerate it only until the vehicle has been continuously away > exitGraceSec.
        const awaySec = (time(p) - time(valid[lastInsideIdx])) / 1000;
        if (awaySec > exitGraceSec) break; // sustained departure → halt ends
        j++; // brief excursion → keep scanning (not folded into the centroid)
      }
    }

    const durationMin = minutesBetween(valid[startIdx].received_at, valid[lastInsideIdx].received_at);
    if (lastInsideIdx > startIdx && durationMin >= minDwellMin) {
      halts.push({
        lat: cLat,
        lng: cLng,
        startTime: valid[startIdx].received_at,
        endTime: valid[lastInsideIdx].received_at,
        durationMin: Math.round(durationMin),
        pointCount: lastInsideIdx - startIdx + 1,
      });
    }

    // Resume after the last confirmed in-cluster point; excursion points get reprocessed.
    i = lastInsideIdx + 1;
  }

  return halts;
}
