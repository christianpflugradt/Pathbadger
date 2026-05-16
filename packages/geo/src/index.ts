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

export type CalculateRouteProgressOptions = {
  preferredDistanceFromStartMeters?: number;
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
  options: CalculateRouteProgressOptions = {},
): RouteProgress {
  if (routeCoordinates.length < 2) {
    throw new RangeError(
      "Route progress requires a polyline with at least two coordinates.",
    );
  }

  let totalDistanceMeters = 0;
  const candidates: ProjectionCandidate[] = [];

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

    if (candidate === null) {
      continue;
    }

    totalDistanceMeters += candidate.segmentLengthMeters;
    candidates.push(candidate);
  }

  if (candidates.length === 0 || totalDistanceMeters === 0) {
    throw new RangeError(
      "Route progress requires at least one non-zero-length route segment.",
    );
  }

  const preferredDistanceFromStartMeters =
    options.preferredDistanceFromStartMeters === undefined
      ? null
      : clamp(options.preferredDistanceFromStartMeters, 0, totalDistanceMeters);
  const bestCandidate = selectBestProjectionCandidate(
    candidates,
    preferredDistanceFromStartMeters,
  );
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
}): ProjectionCandidate | null {
  const segmentLengthMeters = haversineDistanceMeters(start, end);

  if (segmentLengthMeters === 0) {
    return null;
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

function selectBestProjectionCandidate(
  candidates: ReadonlyArray<ProjectionCandidate>,
  preferredDistanceFromStartMeters: number | null,
) {
  const [firstCandidate, ...remainingCandidates] = candidates;

  if (!firstCandidate) {
    throw new RangeError(
      "Route progress requires at least one non-zero-length route segment.",
    );
  }

  let bestCandidate = firstCandidate;

  for (const candidate of remainingCandidates) {
    const candidateScore = getProjectionCandidateScore(
      candidate,
      preferredDistanceFromStartMeters,
    );
    const bestCandidateScore = getProjectionCandidateScore(
      bestCandidate,
      preferredDistanceFromStartMeters,
    );

    if (candidateScore < bestCandidateScore - PROJECTION_SCORE_TIE_TOLERANCE) {
      bestCandidate = candidate;
      continue;
    }

    if (
      Math.abs(candidateScore - bestCandidateScore) <=
        PROJECTION_SCORE_TIE_TOLERANCE &&
      candidate.offRouteDistanceMeters <
        bestCandidate.offRouteDistanceMeters -
          PROJECTION_DISTANCE_TIE_TOLERANCE_METERS
    ) {
      bestCandidate = candidate;
      continue;
    }

    if (
      preferredDistanceFromStartMeters !== null &&
      Math.abs(
        candidate.offRouteDistanceMeters - bestCandidate.offRouteDistanceMeters,
      ) <= PROJECTION_DISTANCE_TIE_TOLERANCE_METERS
    ) {
      const candidateHintDistance = Math.abs(
        candidate.distanceFromStartMeters - preferredDistanceFromStartMeters,
      );
      const bestHintDistance = Math.abs(
        bestCandidate.distanceFromStartMeters -
          preferredDistanceFromStartMeters,
      );

      if (
        candidateHintDistance <
        bestHintDistance - PROGRESS_HINT_TIE_TOLERANCE_METERS
      ) {
        bestCandidate = candidate;
      }
    }
  }

  return bestCandidate;
}

function getProjectionCandidateScore(
  candidate: ProjectionCandidate,
  preferredDistanceFromStartMeters: number | null,
) {
  const progressHintPenalty =
    preferredDistanceFromStartMeters === null
      ? 0
      : Math.abs(
          candidate.distanceFromStartMeters - preferredDistanceFromStartMeters,
        ) * PROGRESS_HINT_DISTANCE_WEIGHT;

  return candidate.offRouteDistanceMeters + progressHintPenalty;
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

const PROJECTION_DISTANCE_TIE_TOLERANCE_METERS = 0.01;
const PROGRESS_HINT_TIE_TOLERANCE_METERS = 0.01;
const PROJECTION_SCORE_TIE_TOLERANCE = 0.01;
const PROGRESS_HINT_DISTANCE_WEIGHT = 0.01;
