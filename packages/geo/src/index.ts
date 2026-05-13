import type { Coordinate, RouteGeometry } from "@pathbadger/shared";

const EARTH_RADIUS_METERS = 6_371_000;

export type RoutePolylineCoordinate = Readonly<
  RouteGeometry["coordinates"][number]
>;

export type RouteProgress = {
  nearestPoint: Coordinate;
  nearestSegmentIndex: number;
  distanceFromStartMeters: number;
  remainingDistanceMeters: number;
  totalDistanceMeters: number;
  offRouteDistanceMeters: number;
  progressFraction: number;
};

export function kilometersToMeters(distanceKm: number) {
  return distanceKm * 1_000;
}

export function haversineDistanceMeters(start: Coordinate, end: Coordinate) {
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLon = toRadians(end.lon - start.lon);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

// Convert a live position into route-following progress against the generated
// LineString so the navigation UI can stay local once a route is loaded.
export function calculateRouteProgress(
  routeCoordinates: ReadonlyArray<RoutePolylineCoordinate>,
  position: Coordinate,
): RouteProgress {
  if (routeCoordinates.length < 2) {
    throw new RangeError(
      "Route progress requires a polyline with at least two coordinates.",
    );
  }

  let totalDistanceMeters = 0;
  let bestCandidate: ProjectionCandidate | null = null;

  for (
    let segmentIndex = 0;
    segmentIndex < routeCoordinates.length - 1;
    segmentIndex += 1
  ) {
    const startCoordinate = routeCoordinates[segmentIndex];
    const endCoordinate = routeCoordinates[segmentIndex + 1];

    if (!startCoordinate || !endCoordinate) {
      continue;
    }

    const start = lineStringCoordinateToCoordinate(startCoordinate);
    const end = lineStringCoordinateToCoordinate(endCoordinate);
    const candidate = projectPositionOntoSegment({
      distanceBeforeSegmentMeters: totalDistanceMeters,
      end,
      position,
      segmentIndex,
      start,
    });

    totalDistanceMeters += candidate.segmentLengthMeters;

    if (
      bestCandidate === null ||
      candidate.offRouteDistanceMeters < bestCandidate.offRouteDistanceMeters
    ) {
      bestCandidate = candidate;
    }
  }

  if (bestCandidate === null) {
    throw new RangeError(
      "Route progress requires at least one usable route segment.",
    );
  }

  const distanceFromStartMeters = clamp(
    bestCandidate.distanceFromStartMeters,
    0,
    totalDistanceMeters,
  );
  const remainingDistanceMeters = Math.max(
    totalDistanceMeters - distanceFromStartMeters,
    0,
  );

  return {
    nearestPoint: bestCandidate.nearestPoint,
    nearestSegmentIndex: bestCandidate.segmentIndex,
    distanceFromStartMeters,
    remainingDistanceMeters,
    totalDistanceMeters,
    offRouteDistanceMeters: bestCandidate.offRouteDistanceMeters,
    progressFraction:
      totalDistanceMeters === 0
        ? 1
        : distanceFromStartMeters / totalDistanceMeters,
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

type ProjectionCandidate = {
  nearestPoint: Coordinate;
  segmentIndex: number;
  distanceFromStartMeters: number;
  offRouteDistanceMeters: number;
  segmentLengthMeters: number;
};

function projectPositionOntoSegment({
  distanceBeforeSegmentMeters,
  end,
  position,
  segmentIndex,
  start,
}: {
  distanceBeforeSegmentMeters: number;
  end: Coordinate;
  position: Coordinate;
  segmentIndex: number;
  start: Coordinate;
}): ProjectionCandidate {
  const segmentLengthMeters = haversineDistanceMeters(start, end);

  if (segmentLengthMeters === 0) {
    return {
      nearestPoint: start,
      segmentIndex,
      distanceFromStartMeters: distanceBeforeSegmentMeters,
      offRouteDistanceMeters: haversineDistanceMeters(start, position),
      segmentLengthMeters: 0,
    };
  }

  const referenceLatRadians = toRadians((start.lat + end.lat) / 2);
  const segmentVector = projectToLocalMeters(start, end, referenceLatRadians);
  const positionVector = projectToLocalMeters(
    start,
    position,
    referenceLatRadians,
  );
  const projectedFraction = clamp(
    dot(segmentVector, positionVector) /
      (segmentVector.x ** 2 + segmentVector.y ** 2),
    0,
    1,
  );
  const nearestPoint = interpolateCoordinate(start, end, projectedFraction);

  return {
    nearestPoint,
    segmentIndex,
    distanceFromStartMeters:
      distanceBeforeSegmentMeters + segmentLengthMeters * projectedFraction,
    offRouteDistanceMeters: haversineDistanceMeters(nearestPoint, position),
    segmentLengthMeters,
  };
}

function lineStringCoordinateToCoordinate(
  coordinate: RoutePolylineCoordinate,
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

function projectToLocalMeters(
  origin: Coordinate,
  target: Coordinate,
  referenceLatRadians: number,
) {
  return {
    x:
      toRadians(target.lon - origin.lon) *
      EARTH_RADIUS_METERS *
      Math.cos(referenceLatRadians),
    y: toRadians(target.lat - origin.lat) * EARTH_RADIUS_METERS,
  };
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x * right.x + left.y * right.y;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
