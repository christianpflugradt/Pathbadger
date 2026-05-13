import { routeGenerateRequestSchema } from "@pathbadger/shared";
import type { Coordinate, RouteGenerateRequest } from "@pathbadger/shared";

const EARTH_RADIUS_METERS = 6_371_000;
const MIN_LOOP_RADIUS_METERS = 750;
const MAX_LOOP_RADIUS_METERS = 10_000;

export interface RouteCandidateWaypointSeed {
  id: string;
  points: Coordinate[];
  randomSeed: string;
  strategy: "triangle_clockwise" | "triangle_counter_clockwise";
  targetDistanceKm: number;
}

export function createRouteCandidateWaypointSeeds(
  request: RouteGenerateRequest,
): RouteCandidateWaypointSeed[] {
  const parsedRequest = routeGenerateRequestSchema.parse(request);
  const resolvedSeed =
    parsedRequest.randomSeed ?? createFallbackSeed(parsedRequest);
  const random = createSeededRandom(resolvedSeed);
  const baseBearingDegrees = random() * 360;
  const targetDistanceMeters = parsedRequest.targetDistanceKm * 1_000;
  const loopRadiusMeters = clamp(
    targetDistanceMeters / 3.4,
    MIN_LOOP_RADIUS_METERS,
    MAX_LOOP_RADIUS_METERS,
  );
  const outerRadiusMeters = loopRadiusMeters * (1.05 + random() * 0.18);
  const innerRadiusMeters = loopRadiusMeters * (0.82 + random() * 0.14);
  const outwardBearing = normalizeBearing(
    baseBearingDegrees + 52 + random() * 18,
  );
  const returnBearing = normalizeBearing(
    baseBearingDegrees + 188 + random() * 24,
  );
  const outwardWaypoint = projectCoordinate(
    parsedRequest.start,
    outerRadiusMeters,
    outwardBearing,
  );
  const returnWaypoint = projectCoordinate(
    parsedRequest.start,
    innerRadiusMeters,
    returnBearing,
  );
  const passThroughPoints =
    parsedRequest.passThroughPoints.map(cloneCoordinate);

  return [
    {
      id: `${resolvedSeed}-clockwise`,
      points: [
        cloneCoordinate(parsedRequest.start),
        outwardWaypoint,
        ...passThroughPoints,
        returnWaypoint,
        cloneCoordinate(parsedRequest.start),
      ],
      randomSeed: resolvedSeed,
      strategy: "triangle_clockwise",
      targetDistanceKm: parsedRequest.targetDistanceKm,
    },
    {
      id: `${resolvedSeed}-counter`,
      points: [
        cloneCoordinate(parsedRequest.start),
        returnWaypoint,
        ...passThroughPoints,
        outwardWaypoint,
        cloneCoordinate(parsedRequest.start),
      ],
      randomSeed: resolvedSeed,
      strategy: "triangle_counter_clockwise",
      targetDistanceKm: parsedRequest.targetDistanceKm,
    },
  ];
}

function createFallbackSeed(request: RouteGenerateRequest) {
  return JSON.stringify({
    activity: request.activity,
    passThroughPoints: request.passThroughPoints,
    start: request.start,
    surfacePreference: request.surfacePreference,
    targetDistanceKm: request.targetDistanceKm,
    toleranceMeters: request.toleranceMeters,
  });
}

function createSeededRandom(seed: string) {
  let hash = 2_166_136_261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return () => {
    hash += 0x6d2b79f5;

    let mixed = Math.imul(hash ^ (hash >>> 15), hash | 1);

    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function projectCoordinate(
  coordinate: Coordinate,
  distanceMeters: number,
  bearingDegrees: number,
) {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRadians = toRadians(bearingDegrees);
  const startLatRadians = toRadians(coordinate.lat);
  const startLonRadians = toRadians(coordinate.lon);
  const projectedLatRadians = Math.asin(
    Math.sin(startLatRadians) * Math.cos(angularDistance) +
      Math.cos(startLatRadians) *
        Math.sin(angularDistance) *
        Math.cos(bearingRadians),
  );
  const projectedLonRadians =
    startLonRadians +
    Math.atan2(
      Math.sin(bearingRadians) *
        Math.sin(angularDistance) *
        Math.cos(startLatRadians),
      Math.cos(angularDistance) -
        Math.sin(startLatRadians) * Math.sin(projectedLatRadians),
    );

  return {
    lat: roundCoordinate(toDegrees(projectedLatRadians)),
    lon: roundCoordinate(normalizeLongitude(toDegrees(projectedLonRadians))),
  };
}

function cloneCoordinate(coordinate: Coordinate): Coordinate {
  return {
    lat: coordinate.lat,
    lon: coordinate.lon,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeBearing(value: number) {
  return ((value % 360) + 360) % 360;
}

function normalizeLongitude(value: number) {
  if (value > 180) {
    return value - 360;
  }

  if (value < -180) {
    return value + 360;
  }

  return value;
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
