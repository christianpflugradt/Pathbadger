import type {
  Coordinate,
  RouteGeometry,
  RouteLoopSummary,
} from "@pathbadger/shared";

const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_OVERLAP_SAMPLE_SPACING_METERS = 20;
const DEFAULT_OVERLAP_CORRIDOR_METERS = 20;
const DEFAULT_ROUTE_DISTANCE_EXCLUSION_METERS = 80;
const OPPOSITE_DIRECTION_DOT_PRODUCT_THRESHOLD = -0.85;

export const MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS = 150;
export const MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS = 50;
export const MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS = 500;
export const MINIMUM_MEANINGFUL_LOOP_CORE_METERS = 1_000;

type LocalDirectionVector = {
  x: number;
  y: number;
};

type SampledRouteSegment = {
  midpoint: Coordinate;
  direction: LocalDirectionVector;
  distanceFromStartMeters: number;
  lengthMeters: number;
};

export function summarizeRouteLoop(options: {
  geometry: RouteGeometry;
  requestedStart: Coordinate;
}): RouteLoopSummary {
  const routeStartCoordinate = options.geometry.coordinates[0];
  const routeEndCoordinate =
    options.geometry.coordinates[options.geometry.coordinates.length - 1];

  if (!routeStartCoordinate || !routeEndCoordinate) {
    throw new RangeError(
      "Route loop analysis requires a route geometry with at least two coordinates.",
    );
  }

  const routeStart = lineStringCoordinateToCoordinate(routeStartCoordinate);
  const routeEnd = lineStringCoordinateToCoordinate(routeEndCoordinate);

  return {
    startOffsetMeters: Math.round(
      haversineDistanceMeters(options.requestedStart, routeStart),
    ),
    endOffsetMeters: Math.round(
      haversineDistanceMeters(options.requestedStart, routeEnd),
    ),
    closureGapMeters: Math.round(haversineDistanceMeters(routeStart, routeEnd)),
    bidirectionalOverlapMeters: Math.round(
      calculateBidirectionalOverlapMeters(options.geometry.coordinates),
    ),
  };
}

export function routeMeetsSupportedRoundTripContract(
  summary: RouteLoopSummary,
) {
  return (
    summary.startOffsetMeters <= MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS &&
    summary.endOffsetMeters <= MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS &&
    summary.closureGapMeters <= MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS &&
    summary.bidirectionalOverlapMeters <=
      MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS
  );
}

export function calculateUniqueLoopCoreMeters(geometry: RouteGeometry) {
  const totalRouteDistanceMeters = calculateRouteDistanceMeters(
    geometry.coordinates,
  );
  const bidirectionalOverlapMeters = calculateBidirectionalOverlapMeters(
    geometry.coordinates,
  );

  return Math.max(
    0,
    Math.round(totalRouteDistanceMeters - bidirectionalOverlapMeters * 2),
  );
}

function calculateBidirectionalOverlapMeters(
  coordinates: RouteGeometry["coordinates"],
) {
  const sampledSegments = sampleRouteSegments(coordinates);
  const totalSampledLengthMeters = sampledSegments.reduce(
    (total, segment) => total + segment.lengthMeters,
    0,
  );
  let markedOverlapLengthMeters = 0;

  for (const [segmentIndex, segment] of sampledSegments.entries()) {
    const hasOppositeDirectionMatch = sampledSegments.some(
      (otherSegment, otherSegmentIndex) => {
        if (segmentIndex === otherSegmentIndex) {
          return false;
        }

        return sampledSegmentsRepresentOppositeOverlap({
          left: segment,
          right: otherSegment,
          totalDistanceMeters: totalSampledLengthMeters,
        });
      },
    );

    if (hasOppositeDirectionMatch) {
      markedOverlapLengthMeters += segment.lengthMeters;
    }
  }

  return markedOverlapLengthMeters / 2;
}

function sampledSegmentsRepresentOppositeOverlap(options: {
  left: SampledRouteSegment;
  right: SampledRouteSegment;
  totalDistanceMeters: number;
}) {
  const routeDistanceDifference = Math.abs(
    options.left.distanceFromStartMeters -
      options.right.distanceFromStartMeters,
  );

  if (routeDistanceDifference <= DEFAULT_ROUTE_DISTANCE_EXCLUSION_METERS) {
    return false;
  }

  if (
    options.totalDistanceMeters - routeDistanceDifference <=
    DEFAULT_ROUTE_DISTANCE_EXCLUSION_METERS
  ) {
    return false;
  }

  if (
    haversineDistanceMeters(options.left.midpoint, options.right.midpoint) >
    DEFAULT_OVERLAP_CORRIDOR_METERS
  ) {
    return false;
  }

  const directionDotProduct =
    options.left.direction.x * options.right.direction.x +
    options.left.direction.y * options.right.direction.y;

  return directionDotProduct <= OPPOSITE_DIRECTION_DOT_PRODUCT_THRESHOLD;
}

function sampleRouteSegments(coordinates: RouteGeometry["coordinates"]) {
  const sampledSegments: SampledRouteSegment[] = [];
  let routeDistanceMeters = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const startCoordinate = coordinates[index - 1];
    const endCoordinate = coordinates[index];

    if (!startCoordinate || !endCoordinate) {
      continue;
    }

    const start = lineStringCoordinateToCoordinate(startCoordinate);
    const end = lineStringCoordinateToCoordinate(endCoordinate);
    const segmentLengthMeters = haversineDistanceMeters(start, end);

    if (segmentLengthMeters === 0) {
      continue;
    }

    const direction = calculateDirectionVector(start, end);

    for (
      let sampledDistanceMeters = 0;
      sampledDistanceMeters < segmentLengthMeters;
      sampledDistanceMeters += DEFAULT_OVERLAP_SAMPLE_SPACING_METERS
    ) {
      const chunkLengthMeters = Math.min(
        DEFAULT_OVERLAP_SAMPLE_SPACING_METERS,
        segmentLengthMeters - sampledDistanceMeters,
      );
      const midpointFraction =
        (sampledDistanceMeters + chunkLengthMeters / 2) / segmentLengthMeters;

      sampledSegments.push({
        midpoint: interpolateCoordinate(start, end, midpointFraction),
        direction,
        distanceFromStartMeters:
          routeDistanceMeters + sampledDistanceMeters + chunkLengthMeters / 2,
        lengthMeters: chunkLengthMeters,
      });
    }

    routeDistanceMeters += segmentLengthMeters;
  }

  return sampledSegments;
}

function calculateRouteDistanceMeters(
  coordinates: RouteGeometry["coordinates"],
) {
  let totalRouteDistanceMeters = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const startCoordinate = coordinates[index - 1];
    const endCoordinate = coordinates[index];

    if (!startCoordinate || !endCoordinate) {
      continue;
    }

    totalRouteDistanceMeters += haversineDistanceMeters(
      lineStringCoordinateToCoordinate(startCoordinate),
      lineStringCoordinateToCoordinate(endCoordinate),
    );
  }

  return totalRouteDistanceMeters;
}

function lineStringCoordinateToCoordinate(
  coordinate: RouteGeometry["coordinates"][number],
): Coordinate {
  const [lon, lat] = coordinate;

  return {
    lat,
    lon,
  };
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

function calculateDirectionVector(start: Coordinate, end: Coordinate) {
  const referenceLatitudeRadians = toRadians((start.lat + end.lat) / 2);
  const x =
    toRadians(end.lon - start.lon) *
    EARTH_RADIUS_METERS *
    Math.cos(referenceLatitudeRadians);
  const y = toRadians(end.lat - start.lat) * EARTH_RADIUS_METERS;
  const magnitude = Math.hypot(x, y);

  return {
    x: x / magnitude,
    y: y / magnitude,
  };
}

function haversineDistanceMeters(start: Coordinate, end: Coordinate) {
  const startLatitudeRadians = toRadians(start.lat);
  const endLatitudeRadians = toRadians(end.lat);
  const deltaLatitudeRadians = toRadians(end.lat - start.lat);
  const deltaLongitudeRadians = toRadians(end.lon - start.lon);

  const a =
    Math.sin(deltaLatitudeRadians / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(deltaLongitudeRadians / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
