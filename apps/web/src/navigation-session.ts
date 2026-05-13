import {
  calculateRouteProgress,
  haversineDistanceMeters,
} from "@pathbadger/geo";
import type {
  Coordinate,
  RouteGeometry,
  RouteInstruction,
} from "@pathbadger/shared";

const EARTH_RADIUS_METERS = 6_371_000;

export const DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS = 40;

export type NavigationInstructionCue = {
  distanceMeters: number;
  instruction: RouteInstruction;
};

export type NavigationSnapshot = {
  currentPosition: Coordinate;
  completedDistanceMeters: number;
  isOffRoute: boolean;
  nextInstruction: NavigationInstructionCue | null;
  offRouteDistanceMeters: number;
  offRouteWarningThresholdMeters: number;
  remainingDistanceMeters: number;
  snappedPosition: Coordinate;
  totalDistanceMeters: number;
  progressFraction: number;
  progressPercent: number;
};

export function createNavigationSnapshot(
  routeGeometry: RouteGeometry,
  options: {
    currentPosition?: Coordinate | null;
    instructions?: ReadonlyArray<RouteInstruction> | null;
    lateralOffsetMeters?: number;
    offRouteWarningThresholdMeters?: number;
    requestedProgressFraction: number;
  },
): NavigationSnapshot {
  const targetRoutePosition = getRoutePositionAtFraction(
    routeGeometry,
    options.requestedProgressFraction,
  );
  const currentPosition = options.currentPosition
    ? options.currentPosition
    : options.lateralOffsetMeters && options.lateralOffsetMeters !== 0
      ? offsetCoordinatePerpendicular(
          targetRoutePosition.coordinate,
          targetRoutePosition.segmentEnd,
          targetRoutePosition.segmentStart,
          options.lateralOffsetMeters,
        )
      : targetRoutePosition.coordinate;
  const preferredDistanceFromStartMeters = options.currentPosition
    ? undefined
    : getTotalRouteDistanceMeters(routeGeometry) *
      clamp(options.requestedProgressFraction, 0, 1);
  const progressOptions =
    preferredDistanceFromStartMeters === undefined
      ? {}
      : {
          preferredDistanceFromStartMeters,
        };
  const progress = calculateRouteProgress(
    routeGeometry.coordinates,
    currentPosition,
    progressOptions,
  );
  const offRouteWarningThresholdMeters =
    options.offRouteWarningThresholdMeters ??
    DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS;

  return {
    currentPosition,
    completedDistanceMeters: progress.distanceFromStartMeters,
    isOffRoute:
      progress.offRouteDistanceMeters > offRouteWarningThresholdMeters,
    nextInstruction: getNextNavigationInstruction(
      options.instructions ?? null,
      progress.distanceFromStartMeters,
    ),
    offRouteDistanceMeters: progress.offRouteDistanceMeters,
    offRouteWarningThresholdMeters,
    remainingDistanceMeters: progress.remainingDistanceMeters,
    snappedPosition: progress.nearestPoint,
    totalDistanceMeters: progress.totalDistanceMeters,
    progressFraction: progress.progressFraction,
    progressPercent: Math.round(progress.progressFraction * 100),
  };
}

export function getRouteCoordinateAtFraction(
  routeGeometry: RouteGeometry,
  requestedProgressFraction: number,
) {
  return getRoutePositionAtFraction(routeGeometry, requestedProgressFraction)
    .coordinate;
}

export function getNextNavigationInstruction(
  instructions: ReadonlyArray<RouteInstruction> | null,
  distanceFromStartMeters: number,
): NavigationInstructionCue | null {
  if (!instructions?.length) {
    return null;
  }

  const nextInstruction =
    instructions.find(
      (instruction) =>
        instruction.distanceFromStartMeters >= distanceFromStartMeters,
    ) ?? instructions[instructions.length - 1];

  if (!nextInstruction) {
    return null;
  }

  return {
    distanceMeters: Math.max(
      nextInstruction.distanceFromStartMeters - distanceFromStartMeters,
      0,
    ),
    instruction: nextInstruction,
  };
}

function getRoutePositionAtFraction(
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
    return {
      coordinate: firstSegment.start,
      segmentEnd: firstSegment.end,
      segmentStart: firstSegment.start,
    };
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
      return interpolateRoutePosition(
        segment.start,
        segment.end,
        (targetDistanceMeters - traversedDistanceMeters) / segment.lengthMeters,
      );
    }

    traversedDistanceMeters = nextTraversedDistanceMeters;
  }

  return {
    coordinate: segments[segments.length - 1]!.end,
    segmentEnd: segments[segments.length - 1]!.end,
    segmentStart: segments[segments.length - 1]!.start,
  };
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

function getTotalRouteDistanceMeters(routeGeometry: RouteGeometry) {
  return getRouteSegments(routeGeometry).reduce(
    (distanceMeters, segment) => distanceMeters + segment.lengthMeters,
    0,
  );
}

function lineStringCoordinateToCoordinate(
  coordinate: RouteGeometry["coordinates"][number],
): Coordinate {
  const [lon, lat] = coordinate;

  return { lat, lon };
}

function interpolateRoutePosition(
  start: Coordinate,
  end: Coordinate,
  fraction: number,
) {
  return {
    coordinate: {
      lat: start.lat + (end.lat - start.lat) * fraction,
      lon: start.lon + (end.lon - start.lon) * fraction,
    },
    segmentEnd: end,
    segmentStart: start,
  };
}

function offsetCoordinatePerpendicular(
  coordinate: Coordinate,
  segmentEnd: Coordinate,
  segmentStart: Coordinate,
  offsetMeters: number,
) {
  const referenceLatRadians = toRadians(coordinate.lat);
  const segmentVector = projectToLocalMeters(
    segmentStart,
    segmentEnd,
    referenceLatRadians,
  );
  const segmentLengthMeters = Math.hypot(segmentVector.x, segmentVector.y);

  if (segmentLengthMeters === 0) {
    return {
      lat: coordinate.lat + toDegrees(offsetMeters / EARTH_RADIUS_METERS),
      lon: coordinate.lon,
    };
  }

  const unitPerpendicular = {
    x: -segmentVector.y / segmentLengthMeters,
    y: segmentVector.x / segmentLengthMeters,
  };

  return translateCoordinateInLocalMeters(
    coordinate,
    {
      x: unitPerpendicular.x * offsetMeters,
      y: unitPerpendicular.y * offsetMeters,
    },
    referenceLatRadians,
  );
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

function translateCoordinateInLocalMeters(
  origin: Coordinate,
  offset: { x: number; y: number },
  referenceLatRadians: number,
) {
  return {
    lat: origin.lat + toDegrees(offset.y / EARTH_RADIUS_METERS),
    lon:
      origin.lon +
      toDegrees(
        offset.x / (EARTH_RADIUS_METERS * Math.cos(referenceLatRadians)),
      ),
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
