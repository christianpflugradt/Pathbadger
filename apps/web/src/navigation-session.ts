import {
  calculateRouteProgress,
  haversineDistanceMeters,
} from "@pathbadger/geo";
import type { Coordinate, RouteGeometry } from "@pathbadger/shared";

export type NavigationSnapshot = {
  currentPosition: Coordinate;
  completedDistanceMeters: number;
  remainingDistanceMeters: number;
  totalDistanceMeters: number;
  progressFraction: number;
  progressPercent: number;
};

export function createNavigationSnapshot(
  routeGeometry: RouteGeometry,
  requestedProgressFraction: number,
): NavigationSnapshot {
  const currentPosition = getRouteCoordinateAtFraction(
    routeGeometry,
    requestedProgressFraction,
  );
  const progress = calculateRouteProgress(
    routeGeometry.coordinates,
    currentPosition,
  );

  return {
    currentPosition,
    completedDistanceMeters: progress.distanceFromStartMeters,
    remainingDistanceMeters: progress.remainingDistanceMeters,
    totalDistanceMeters: progress.totalDistanceMeters,
    progressFraction: progress.progressFraction,
    progressPercent: Math.round(progress.progressFraction * 100),
  };
}

export function getRouteCoordinateAtFraction(
  routeGeometry: RouteGeometry,
  requestedProgressFraction: number,
) {
  const segments = getRouteSegments(routeGeometry);
  const [firstSegment] = segments;

  if (!firstSegment) {
    throw new RangeError(
      "Navigation session requires a route geometry with at least one segment.",
    );
  }

  const totalDistanceMeters = segments.reduce(
    (distanceMeters, segment) => distanceMeters + segment.lengthMeters,
    0,
  );

  if (totalDistanceMeters === 0) {
    return firstSegment.start;
  }

  const targetDistanceMeters =
    totalDistanceMeters * clamp(requestedProgressFraction, 0, 1);
  let traversedDistanceMeters = 0;

  for (const segment of segments) {
    if (segment.lengthMeters === 0) {
      continue;
    }

    const nextTraversedDistanceMeters =
      traversedDistanceMeters + segment.lengthMeters;

    if (targetDistanceMeters <= nextTraversedDistanceMeters) {
      return interpolateCoordinate(
        segment.start,
        segment.end,
        (targetDistanceMeters - traversedDistanceMeters) / segment.lengthMeters,
      );
    }

    traversedDistanceMeters = nextTraversedDistanceMeters;
  }

  return segments[segments.length - 1]!.end;
}

function getRouteSegments(routeGeometry: RouteGeometry) {
  return routeGeometry.coordinates
    .slice(0, -1)
    .map((coordinate, index) => {
      const nextCoordinate = routeGeometry.coordinates[index + 1];

      if (!nextCoordinate) {
        return null;
      }

      const start = lineStringCoordinateToCoordinate(coordinate);
      const end = lineStringCoordinateToCoordinate(nextCoordinate);

      return {
        end,
        lengthMeters: haversineDistanceMeters(start, end),
        start,
      };
    })
    .filter((segment) => segment !== null);
}

function lineStringCoordinateToCoordinate(
  coordinate: RouteGeometry["coordinates"][number],
): Coordinate {
  const [lon, lat] = coordinate;

  return { lat, lon };
}

function interpolateCoordinate(
  start: Coordinate,
  end: Coordinate,
  fraction: number,
): Coordinate {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lon: start.lon + (end.lon - start.lon) * fraction,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
