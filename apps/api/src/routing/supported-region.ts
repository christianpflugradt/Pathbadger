import type { Coordinate, RouteGeometry } from "@pathbadger/shared";

import { SCHLESWIG_HOLSTEIN_REGION_FIXTURE } from "./schleswig-holstein-region.fixture.js";

export const DEFAULT_SUPPORTED_REGION_NAME = "Schleswig-Holstein";

const BOUNDARY_EPSILON = 1e-9;

type Position = readonly [number, number];
type PolygonCoordinates = Position[][];

export type SupportedRegionGeometry =
  | {
      type: "Polygon";
      coordinates: PolygonCoordinates;
    }
  | {
      type: "MultiPolygon";
      coordinates: PolygonCoordinates[];
    };

export interface SupportedRegion {
  name: string;
  containsCoordinate(coordinate: Coordinate): boolean;
  containsRouteGeometry(geometry: RouteGeometry): boolean;
}

export function createSupportedRegion(options: {
  name: string;
  geometry: SupportedRegionGeometry;
}): SupportedRegion {
  const polygons = toPolygonCoordinates(options.geometry);

  return {
    name: options.name,
    containsCoordinate(coordinate) {
      return containsPositionInPolygons(
        [coordinate.lon, coordinate.lat],
        polygons,
      );
    },
    containsRouteGeometry(geometry) {
      if (
        !geometry.coordinates.every((coordinate) =>
          containsPositionInPolygons(coordinate, polygons),
        )
      ) {
        return false;
      }

      for (let index = 1; index < geometry.coordinates.length; index += 1) {
        const previousCoordinate = geometry.coordinates[index - 1];
        const currentCoordinate = geometry.coordinates[index];

        if (!previousCoordinate || !currentCoordinate) {
          return false;
        }

        if (
          !segmentStaysWithinPolygons(
            previousCoordinate,
            currentCoordinate,
            polygons,
          )
        ) {
          return false;
        }
      }

      return true;
    },
  };
}

export function createSchleswigHolsteinSupportedRegion(
  name = DEFAULT_SUPPORTED_REGION_NAME,
): SupportedRegion {
  return createSupportedRegion({
    name,
    geometry: SCHLESWIG_HOLSTEIN_REGION_FIXTURE,
  });
}

function toPolygonCoordinates(geometry: SupportedRegionGeometry) {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function containsPositionInPolygons(
  position: Position,
  polygons: PolygonCoordinates[],
) {
  return polygons.some((polygon) =>
    containsPositionInPolygon(position, polygon),
  );
}

function containsPositionInPolygon(
  position: Position,
  polygon: PolygonCoordinates,
) {
  const [outerRing, ...holeRings] = polygon;

  if (!outerRing || !containsPositionInRing(position, outerRing)) {
    return false;
  }

  return holeRings.every(
    (holeRing) => !containsPositionInRing(position, holeRing),
  );
}

function containsPositionInRing(position: Position, ring: Position[]) {
  if (ring.length < 3) {
    return false;
  }

  if (isPositionOnRingBoundary(position, ring)) {
    return true;
  }

  const [pointLon, pointLat] = position;
  let isInside = false;

  for (
    let currentIndex = 0, previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const [currentLon, currentLat] = ring[currentIndex] ?? position;
    const [previousLon, previousLat] = ring[previousIndex] ?? position;
    const edgeCrossesLatitude =
      currentLat > pointLat !== previousLat > pointLat;

    if (!edgeCrossesLatitude) {
      continue;
    }

    const intersectionLon =
      ((previousLon - currentLon) * (pointLat - currentLat)) /
        (previousLat - currentLat) +
      currentLon;

    if (pointLon < intersectionLon) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function segmentStaysWithinPolygons(
  segmentStart: Position,
  segmentEnd: Position,
  polygons: PolygonCoordinates[],
) {
  if (positionsEqual(segmentStart, segmentEnd)) {
    return containsPositionInPolygons(segmentStart, polygons);
  }

  const intersectionParameters = collectSegmentBoundaryParameters(
    segmentStart,
    segmentEnd,
    polygons,
  );

  for (const parameter of intersectionParameters) {
    if (
      !containsPositionInPolygons(
        interpolatePosition(segmentStart, segmentEnd, parameter),
        polygons,
      )
    ) {
      return false;
    }
  }

  for (let index = 1; index < intersectionParameters.length; index += 1) {
    const previousParameter = intersectionParameters[index - 1];
    const currentParameter = intersectionParameters[index];

    if (
      previousParameter === undefined ||
      currentParameter === undefined ||
      currentParameter - previousParameter <= BOUNDARY_EPSILON
    ) {
      continue;
    }

    const midpointParameter = (previousParameter + currentParameter) / 2;

    if (
      !containsPositionInPolygons(
        interpolatePosition(segmentStart, segmentEnd, midpointParameter),
        polygons,
      )
    ) {
      return false;
    }
  }

  return true;
}

function collectSegmentBoundaryParameters(
  segmentStart: Position,
  segmentEnd: Position,
  polygons: PolygonCoordinates[],
) {
  const parameters = [0, 1];

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let index = 0; index < ring.length; index += 1) {
        const edgeStart = ring[index];
        const edgeEnd = ring[(index + 1) % ring.length];

        if (!edgeStart || !edgeEnd) {
          continue;
        }

        parameters.push(
          ...getSegmentIntersectionParameters(
            segmentStart,
            segmentEnd,
            edgeStart,
            edgeEnd,
          ),
        );
      }
    }
  }

  return [...parameters]
    .map(normalizeSegmentParameter)
    .sort((left, right) => left - right)
    .filter(
      (parameter, index, sortedParameters) =>
        index === 0 ||
        Math.abs(parameter - (sortedParameters[index - 1] ?? parameter)) >
          BOUNDARY_EPSILON,
    );
}

function getSegmentIntersectionParameters(
  segmentStart: Position,
  segmentEnd: Position,
  edgeStart: Position,
  edgeEnd: Position,
) {
  const segmentVector = subtractPositions(segmentEnd, segmentStart);
  const edgeVector = subtractPositions(edgeEnd, edgeStart);
  const edgeStartOffset = subtractPositions(edgeStart, segmentStart);
  const segmentCrossEdge = crossProduct(segmentVector, edgeVector);
  const edgeOffsetCrossSegment = crossProduct(edgeStartOffset, segmentVector);

  if (
    Math.abs(segmentCrossEdge) <= BOUNDARY_EPSILON &&
    Math.abs(edgeOffsetCrossSegment) <= BOUNDARY_EPSILON
  ) {
    const segmentLengthSquared = dotProduct(segmentVector, segmentVector);

    if (segmentLengthSquared <= BOUNDARY_EPSILON) {
      return [];
    }

    const overlapStart =
      dotProduct(edgeStartOffset, segmentVector) / segmentLengthSquared;
    const overlapEnd =
      dotProduct(subtractPositions(edgeEnd, segmentStart), segmentVector) /
      segmentLengthSquared;
    const normalizedOverlapStart = Math.max(
      0,
      Math.min(overlapStart, overlapEnd),
    );
    const normalizedOverlapEnd = Math.min(
      1,
      Math.max(overlapStart, overlapEnd),
    );

    return normalizedOverlapStart <= normalizedOverlapEnd + BOUNDARY_EPSILON
      ? [normalizedOverlapStart, normalizedOverlapEnd]
      : [];
  }

  if (Math.abs(segmentCrossEdge) <= BOUNDARY_EPSILON) {
    return [];
  }

  const segmentParameter =
    crossProduct(edgeStartOffset, edgeVector) / segmentCrossEdge;
  const edgeParameter = edgeOffsetCrossSegment / segmentCrossEdge;

  if (
    segmentParameter < -BOUNDARY_EPSILON ||
    segmentParameter > 1 + BOUNDARY_EPSILON ||
    edgeParameter < -BOUNDARY_EPSILON ||
    edgeParameter > 1 + BOUNDARY_EPSILON
  ) {
    return [];
  }

  return [segmentParameter];
}

function isPositionOnRingBoundary(position: Position, ring: Position[]) {
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];

    if (!start || !end) {
      continue;
    }

    if (isPositionOnSegment(position, start, end)) {
      return true;
    }
  }

  return false;
}

function isPositionOnSegment(
  position: Position,
  segmentStart: Position,
  segmentEnd: Position,
) {
  const [pointLon, pointLat] = position;
  const [startLon, startLat] = segmentStart;
  const [endLon, endLat] = segmentEnd;
  const crossProduct =
    (pointLat - startLat) * (endLon - startLon) -
    (pointLon - startLon) * (endLat - startLat);

  if (Math.abs(crossProduct) > BOUNDARY_EPSILON) {
    return false;
  }

  return (
    pointLon >= Math.min(startLon, endLon) - BOUNDARY_EPSILON &&
    pointLon <= Math.max(startLon, endLon) + BOUNDARY_EPSILON &&
    pointLat >= Math.min(startLat, endLat) - BOUNDARY_EPSILON &&
    pointLat <= Math.max(startLat, endLat) + BOUNDARY_EPSILON
  );
}

function positionsEqual(left: Position, right: Position) {
  return (
    Math.abs(left[0] - right[0]) <= BOUNDARY_EPSILON &&
    Math.abs(left[1] - right[1]) <= BOUNDARY_EPSILON
  );
}

function interpolatePosition(
  start: Position,
  end: Position,
  parameter: number,
): Position {
  return [
    start[0] + (end[0] - start[0]) * parameter,
    start[1] + (end[1] - start[1]) * parameter,
  ];
}

function subtractPositions(left: Position, right: Position): Position {
  return [left[0] - right[0], left[1] - right[1]];
}

function crossProduct(left: Position, right: Position) {
  return left[0] * right[1] - left[1] * right[0];
}

function dotProduct(left: Position, right: Position) {
  return left[0] * right[0] + left[1] * right[1];
}

function normalizeSegmentParameter(parameter: number) {
  if (parameter <= BOUNDARY_EPSILON) {
    return 0;
  }

  if (parameter >= 1 - BOUNDARY_EPSILON) {
    return 1;
  }

  return parameter;
}
