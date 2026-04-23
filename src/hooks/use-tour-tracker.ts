"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * PROJ-41 — Tour-Tracker Hook.
 *
 * Wraps `navigator.geolocation.watchPosition`, accumulates GPS points,
 * derives live stats (distance via haversine, current/avg speed, elevation
 * gain/loss with EMA smoothing), and persists a snapshot to localStorage
 * every 30 s for crash recovery.
 *
 * All calculations are silent-fail: a missing altitude or a position error
 * never throws — it just short-circuits that data source.
 */

export type TourStatus = "idle" | "recording" | "paused";

export interface TourPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  timestamp: number; // ms since epoch
  speedMs: number | null; // meters per second, from GeolocationPosition.coords.speed
}

export interface TourStats {
  distanceM: number; // total distance in meters (haversine)
  activeDurationMs: number; // elapsed minus pauses
  currentSpeedKmh: number; // 0 when paused or no signal
  avgSpeedKmh: number; // distance / activeDuration
  elevationGainM: number;
  elevationLossM: number;
}

export type TourGpsStatus = "granted" | "denied" | "unavailable" | "unknown";

export interface UseTourTrackerReturn {
  status: TourStatus;
  stats: TourStats;
  points: TourPoint[];
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  gpsStatus: TourGpsStatus;
  resumeFromSnapshot: () => boolean;
  clearSnapshot: () => void;
  hasSnapshot: boolean;
  signalLost: boolean;
}

interface SnapshotV1 {
  version: 1;
  savedAt: number;
  status: TourStatus;
  points: TourPoint[];
  distanceM: number;
  elevationGainM: number;
  elevationLossM: number;
  startedAt: number | null;
  accumulatedActiveMs: number; // activeDurationMs as of the last pause
  lastSmoothedAltitude: number | null;
}

const EMPTY_STATS: TourStats = {
  distanceM: 0,
  activeDurationMs: 0,
  currentSpeedKmh: 0,
  avgSpeedKmh: 0,
  elevationGainM: 0,
  elevationLossM: 0,
};

const MIN_POINT_INTERVAL_MS = 3000; // throttle new points to 1 per 3 s
const ELEVATION_EMA_ALPHA = 0.3;
const ELEVATION_MIN_DELTA_M = 2;
const SIGNAL_LOST_TIMEOUT_MS = 10_000;
const SNAPSHOT_INTERVAL_MS = 30_000;
const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

function storageKey(eventId: string) {
  return `tour-tracker-snapshot-${eventId}`;
}

/**
 * Haversine great-circle distance in meters.
 */
function haversine(a: TourPoint, b: TourPoint): number {
  const R = 6_371_000; // earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function readSnapshot(eventId: string): SnapshotV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SnapshotV1;
    if (!parsed || parsed.version !== 1) return null;
    if (Date.now() - parsed.savedAt > SNAPSHOT_TTL_MS) {
      window.localStorage.removeItem(storageKey(eventId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(eventId: string, snapshot: SnapshotV1) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(eventId), JSON.stringify(snapshot));
  } catch {
    // ignore quota errors — snapshot is a nice-to-have
  }
}

function removeSnapshot(eventId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}

export function useTourTracker(eventId: string): UseTourTrackerReturn {
  const [status, setStatus] = useState<TourStatus>("idle");
  const [points, setPoints] = useState<TourPoint[]>([]);
  const [stats, setStats] = useState<TourStats>(EMPTY_STATS);
  const [gpsStatus, setGpsStatus] = useState<TourGpsStatus>("unknown");
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [signalLost, setSignalLost] = useState(false);

  // Mutable refs for values updated on every GPS tick — avoids state-setter
  // avalanches and keeps derivations synchronous inside the watch callback.
  const pointsRef = useRef<TourPoint[]>([]);
  const distanceRef = useRef(0);
  const elevationGainRef = useRef(0);
  const elevationLossRef = useRef(0);
  const smoothedAltitudeRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedActiveMsRef = useRef(0); // active ms from completed segments (pre-last-resume)
  const segmentStartedAtRef = useRef<number | null>(null); // start of the current recording segment
  const watchIdRef = useRef<number | null>(null);
  const skipNextHaversineRef = useRef(false); // true right after resume — next point starts a new segment
  const lastTickAtRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const statusRef = useRef<TourStatus>("idle");

  // Keep statusRef in sync so interval callbacks see the current status.
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Check for an existing snapshot once on mount. setState happens in a
  // microtask to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const snap = readSnapshot(eventId);
      setHasSnapshot(!!snap);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Probe the Permissions API once on mount to set initial gpsStatus.
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => {
        if (!cancelled) setGpsStatus("unavailable");
      });
      return () => {
        cancelled = true;
      };
    }
    const perms = (
      navigator as Navigator & {
        permissions?: {
          query: (d: { name: string }) => Promise<{ state: string }>;
        };
      }
    ).permissions;
    if (!perms?.query) {
      queueMicrotask(() => {
        if (!cancelled) setGpsStatus("unknown");
      });
      return () => {
        cancelled = true;
      };
    }
    perms
      .query({ name: "geolocation" })
      .then((res) => {
        if (cancelled) return;
        if (res.state === "granted") setGpsStatus("granted");
        else if (res.state === "denied") setGpsStatus("denied");
        else setGpsStatus("unknown");
      })
      .catch(() => {
        if (!cancelled) setGpsStatus("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const computeActiveMs = useCallback((): number => {
    const base = accumulatedActiveMsRef.current;
    const segStart = segmentStartedAtRef.current;
    if (statusRef.current === "recording" && segStart != null) {
      return base + (Date.now() - segStart);
    }
    return base;
  }, []);

  const publishStats = useCallback(() => {
    const distanceM = distanceRef.current;
    const activeMs = computeActiveMs();
    const avgSpeedKmh =
      activeMs > 0 ? (distanceM / (activeMs / 1000)) * 3.6 : 0;

    // Current speed: prefer coords.speed on the latest point, fall back to
    // the Δ between the two most recent points. Zero out when paused or the
    // signal is lost.
    let currentSpeedKmh = 0;
    const arr = pointsRef.current;
    const now = Date.now();
    const lost =
      statusRef.current === "recording" &&
      lastTickAtRef.current != null &&
      now - lastTickAtRef.current > SIGNAL_LOST_TIMEOUT_MS;

    if (statusRef.current === "recording" && !lost && arr.length > 0) {
      const latest = arr[arr.length - 1];
      if (latest.speedMs != null && latest.speedMs >= 0) {
        currentSpeedKmh = latest.speedMs * 3.6;
      } else if (arr.length >= 2) {
        const prev = arr[arr.length - 2];
        const dtMs = latest.timestamp - prev.timestamp;
        if (dtMs > 0) {
          const d = haversine(prev, latest);
          currentSpeedKmh = (d / (dtMs / 1000)) * 3.6;
        }
      }
    }

    setStats({
      distanceM,
      activeDurationMs: activeMs,
      currentSpeedKmh: Math.max(0, currentSpeedKmh),
      avgSpeedKmh,
      elevationGainM: elevationGainRef.current,
      elevationLossM: elevationLossRef.current,
    });
    setSignalLost(lost);
  }, [computeActiveMs]);

  const persistSnapshot = useCallback(() => {
    if (statusRef.current === "idle") return;
    const snap: SnapshotV1 = {
      version: 1,
      savedAt: Date.now(),
      status: statusRef.current,
      points: pointsRef.current,
      distanceM: distanceRef.current,
      elevationGainM: elevationGainRef.current,
      elevationLossM: elevationLossRef.current,
      startedAt: startedAtRef.current,
      accumulatedActiveMs: computeActiveMs(),
      lastSmoothedAltitude: smoothedAltitudeRef.current,
    };
    writeSnapshot(eventId, snap);
  }, [eventId, computeActiveMs]);

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      lastTickAtRef.current = Date.now();
      if (gpsStatus !== "granted") setGpsStatus("granted");

      const now = pos.timestamp ?? Date.now();
      const point: TourPoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        altitude: pos.coords.altitude ?? null,
        timestamp: now,
        speedMs: pos.coords.speed ?? null,
      };

      // Throttle: ignore points arriving faster than MIN_POINT_INTERVAL_MS.
      const arr = pointsRef.current;
      if (arr.length > 0) {
        const lastTs = arr[arr.length - 1].timestamp;
        if (now - lastTs < MIN_POINT_INTERVAL_MS) {
          return;
        }
      }

      // Distance accumulation — skip the first point after resume so a
      // cold-start gap doesn't get counted as a phantom move.
      if (arr.length > 0) {
        if (skipNextHaversineRef.current) {
          skipNextHaversineRef.current = false;
        } else {
          distanceRef.current += haversine(arr[arr.length - 1], point);
        }
      }

      // Elevation gain/loss via EMA-smoothed altitude + 2 m min-delta.
      if (point.altitude != null && Number.isFinite(point.altitude)) {
        const prevSmoothed = smoothedAltitudeRef.current;
        if (prevSmoothed == null) {
          smoothedAltitudeRef.current = point.altitude;
        } else {
          const next =
            ELEVATION_EMA_ALPHA * point.altitude +
            (1 - ELEVATION_EMA_ALPHA) * prevSmoothed;
          const delta = next - prevSmoothed;
          if (Math.abs(delta) > ELEVATION_MIN_DELTA_M) {
            if (delta > 0) elevationGainRef.current += delta;
            else elevationLossRef.current += -delta;
            smoothedAltitudeRef.current = next;
          } else {
            // below noise threshold — update smoothed value anyway so EMA keeps converging
            smoothedAltitudeRef.current = next;
          }
        }
      }

      pointsRef.current = [...arr, point];
      setPoints(pointsRef.current);
      publishStats();
    },
    [gpsStatus, publishStats]
  );

  const handlePositionError = useCallback(
    (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGpsStatus("denied");
        // Stop watching — it won't recover without a permission prompt.
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        // Keep watching; the publishStats tick will flag signal-lost.
      }
      publishStats();
    },
    [publishStats]
  );

  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
    if (watchIdRef.current != null) return;
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handlePositionError,
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 2_000 }
      );
    } catch {
      setGpsStatus("unavailable");
    }
  }, [handlePosition, handlePositionError]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== "undefined") {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {
        // ignore
      }
    }
    watchIdRef.current = null;
  }, []);

  // Timer tick — keep activeDurationMs + current-speed-decay fresh even
  // when the GPS is silent.
  useEffect(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (status === "recording") {
      tickIntervalRef.current = setInterval(() => publishStats(), 1000);
    }
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [status, publishStats]);

  // Snapshot timer — every 30 s while recording.
  useEffect(() => {
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (status === "recording") {
      snapshotIntervalRef.current = setInterval(
        () => persistSnapshot(),
        SNAPSHOT_INTERVAL_MS
      );
    }
    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }
    };
  }, [status, persistSnapshot]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopWatch();
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (snapshotIntervalRef.current)
        clearInterval(snapshotIntervalRef.current);
    };
  }, [stopWatch]);

  const start = useCallback(() => {
    // Fresh recording — reset all accumulators.
    pointsRef.current = [];
    distanceRef.current = 0;
    elevationGainRef.current = 0;
    elevationLossRef.current = 0;
    smoothedAltitudeRef.current = null;
    accumulatedActiveMsRef.current = 0;
    startedAtRef.current = Date.now();
    segmentStartedAtRef.current = Date.now();
    lastTickAtRef.current = null;
    skipNextHaversineRef.current = false;
    setPoints([]);
    setSignalLost(false);
    setStatus("recording");
    startWatch();
    publishStats();
    persistSnapshot();
  }, [startWatch, publishStats, persistSnapshot]);

  const pause = useCallback(() => {
    // Roll the current segment into the accumulator, then stop watching.
    if (segmentStartedAtRef.current != null) {
      accumulatedActiveMsRef.current += Date.now() - segmentStartedAtRef.current;
      segmentStartedAtRef.current = null;
    }
    stopWatch();
    setStatus("paused");
    publishStats();
    persistSnapshot();
  }, [stopWatch, publishStats, persistSnapshot]);

  const resume = useCallback(() => {
    segmentStartedAtRef.current = Date.now();
    skipNextHaversineRef.current = true;
    lastTickAtRef.current = null;
    setSignalLost(false);
    setStatus("recording");
    startWatch();
    publishStats();
    persistSnapshot();
  }, [startWatch, publishStats, persistSnapshot]);

  const reset = useCallback(() => {
    stopWatch();
    pointsRef.current = [];
    distanceRef.current = 0;
    elevationGainRef.current = 0;
    elevationLossRef.current = 0;
    smoothedAltitudeRef.current = null;
    accumulatedActiveMsRef.current = 0;
    startedAtRef.current = null;
    segmentStartedAtRef.current = null;
    lastTickAtRef.current = null;
    skipNextHaversineRef.current = false;
    setPoints([]);
    setStats(EMPTY_STATS);
    setSignalLost(false);
    setStatus("idle");
  }, [stopWatch]);

  const clearSnapshot = useCallback(() => {
    removeSnapshot(eventId);
    setHasSnapshot(false);
  }, [eventId]);

  const resumeFromSnapshot = useCallback((): boolean => {
    const snap = readSnapshot(eventId);
    if (!snap) {
      setHasSnapshot(false);
      return false;
    }
    // Restore mutable state.
    pointsRef.current = snap.points;
    distanceRef.current = snap.distanceM;
    elevationGainRef.current = snap.elevationGainM;
    elevationLossRef.current = snap.elevationLossM;
    smoothedAltitudeRef.current = snap.lastSmoothedAltitude;
    accumulatedActiveMsRef.current = snap.accumulatedActiveMs;
    startedAtRef.current = snap.startedAt;
    segmentStartedAtRef.current = null; // always enter as paused — user decides to resume
    lastTickAtRef.current = null;
    skipNextHaversineRef.current = true;
    setPoints(snap.points);
    setSignalLost(false);
    setStatus("paused");
    publishStats();
    return true;
  }, [eventId, publishStats]);

  return {
    status,
    stats,
    points,
    start,
    pause,
    resume,
    reset,
    gpsStatus,
    resumeFromSnapshot,
    clearSnapshot,
    hasSnapshot,
    signalLost,
  };
}
