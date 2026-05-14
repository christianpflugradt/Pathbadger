import type { BrowserGeolocationPosition } from "./browser-geolocation";
import type { NavigationSnapshot } from "./navigation-session";

export type NavigationSpeedBaseline = {
  completedDistanceMeters: number;
  timestampMs: number;
};

export type NavigationSpeedMetrics = {
  averageSpeedKmh: number | null;
  currentSpeedKmh: number | null;
};

export function createNavigationSpeedBaseline(options: {
  position: BrowserGeolocationPosition;
  snapshot: Pick<NavigationSnapshot, "completedDistanceMeters">;
}): NavigationSpeedBaseline {
  return {
    completedDistanceMeters: options.snapshot.completedDistanceMeters,
    timestampMs: options.position.timestampMs,
  };
}

export function getNavigationSpeedMetrics(options: {
  baseline: NavigationSpeedBaseline | null;
  hasFreshPosition: boolean;
  position: BrowserGeolocationPosition;
  snapshot: Pick<NavigationSnapshot, "completedDistanceMeters">;
}): NavigationSpeedMetrics {
  return {
    averageSpeedKmh: getAverageSpeedKmh({
      baseline: options.baseline,
      currentCompletedDistanceMeters: options.snapshot.completedDistanceMeters,
      currentTimestampMs: options.position.timestampMs,
    }),
    currentSpeedKmh: options.hasFreshPosition
      ? metersPerSecondToKilometersPerHour(
          options.position.speedMetersPerSecond,
        )
      : null,
  };
}

export function formatNavigationSpeedKmh(speedKmh: number | null) {
  if (speedKmh === null) {
    return "Unavailable";
  }

  return `${speedKmh.toFixed(1)} km/h`;
}

export function getNavigationSpeedHelperCopy(options: {
  averageSpeedKmh: number | null;
  baseline: NavigationSpeedBaseline | null;
  currentSpeedKmh: number | null;
  hasFreshPosition: boolean;
}) {
  if (options.currentSpeedKmh !== null && options.averageSpeedKmh !== null) {
    return null;
  }

  if (!options.hasFreshPosition && options.averageSpeedKmh !== null) {
    return "Current speed is unavailable because the browser is not providing a fresh GPS speed sample. Average speed still reflects the last timestamped route progress.";
  }

  if (options.currentSpeedKmh === null && options.averageSpeedKmh === null) {
    return options.baseline
      ? "Browser geolocation has not produced a stable instantaneous speed yet. Average speed will appear after a later timestamped route-progress update."
      : "Browser geolocation has not produced enough timestamped route progress to estimate average speed yet, and it is not exposing a stable instantaneous speed sample.";
  }

  if (options.currentSpeedKmh === null) {
    return "Browser geolocation is not exposing a stable instantaneous speed sample yet.";
  }

  return "Average speed will appear after another timestamped route-progress update.";
}

function getAverageSpeedKmh(options: {
  baseline: NavigationSpeedBaseline | null;
  currentCompletedDistanceMeters: number;
  currentTimestampMs: number;
}) {
  if (!options.baseline) {
    return null;
  }

  const elapsedMilliseconds =
    options.currentTimestampMs - options.baseline.timestampMs;

  if (elapsedMilliseconds <= 0) {
    return null;
  }

  const completedDistanceDeltaMeters = Math.max(
    options.currentCompletedDistanceMeters -
      options.baseline.completedDistanceMeters,
    0,
  );

  return metersPerSecondToKilometersPerHour(
    completedDistanceDeltaMeters / (elapsedMilliseconds / 1_000),
  );
}

function metersPerSecondToKilometersPerHour(
  speedMetersPerSecond: number | null,
) {
  if (
    typeof speedMetersPerSecond !== "number" ||
    !Number.isFinite(speedMetersPerSecond)
  ) {
    return null;
  }

  return Math.max(speedMetersPerSecond, 0) * 3.6;
}
