import type { Coordinate } from "@pathbadger/shared";

const EARTH_RADIUS_METERS = 6_371_000;

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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
