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
      return geometry.coordinates.every((coordinate) =>
        containsPositionInPolygons(coordinate, polygons),
      );
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
