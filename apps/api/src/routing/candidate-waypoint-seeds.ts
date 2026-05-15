import { routeGenerateRequestSchema } from "@pathbadger/shared";
import type { Coordinate, RouteGenerateRequest } from "@pathbadger/shared";

const EARTH_RADIUS_METERS = 6_371_000;
const MIN_LOOP_RADIUS_METERS = 450;
const MAX_LOOP_RADIUS_METERS = 10_000;

type OrbitLoopTemplate = {
  baseBearingDegrees: number;
  centerOffsetFactor: number;
  orbitBearingOffsets: number[];
  radiusFactor: number;
};

const ORBIT_LOOP_TEMPLATES: OrbitLoopTemplate[] = [
  {
    baseBearingDegrees: 267,
    centerOffsetFactor: 0.82,
    orbitBearingOffsets: [47, 123, 218, 301],
    radiusFactor: 0.10675,
  },
  {
    baseBearingDegrees: 270,
    centerOffsetFactor: 0.82,
    orbitBearingOffsets: [47, 123, 218, 301],
    radiusFactor: 0.10675,
  },
  {
    baseBearingDegrees: 285,
    centerOffsetFactor: 0.82,
    orbitBearingOffsets: [47, 123, 218, 301],
    radiusFactor: 0.10675,
  },
  {
    baseBearingDegrees: 288,
    centerOffsetFactor: 0.82,
    orbitBearingOffsets: [47, 123, 218, 301],
    radiusFactor: 0.10675,
  },
  {
    baseBearingDegrees: 270,
    centerOffsetFactor: 0.93,
    orbitBearingOffsets: [38, 120, 220, 306],
    radiusFactor: 0.1035,
  },
  {
    baseBearingDegrees: 294,
    centerOffsetFactor: 0.96,
    orbitBearingOffsets: [26, 113, 206, 287],
    radiusFactor: 0.104875,
  },
];

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
  const targetDistanceMeters = parsedRequest.targetDistanceKm * 1_000;
  const selectedTemplates = selectOrbitLoopTemplates(random);
  const passThroughPoints =
    parsedRequest.passThroughPoints.map(cloneCoordinate);

  return [
    buildRouteCandidateWaypointSeed({
      id: `${resolvedSeed}-clockwise`,
      loopTemplate: selectedTemplates[0],
      passThroughPoints,
      randomSeed: resolvedSeed,
      start: parsedRequest.start,
      strategy: "triangle_clockwise",
      targetDistanceMeters,
      targetDistanceKm: parsedRequest.targetDistanceKm,
    }),
    buildRouteCandidateWaypointSeed({
      id: `${resolvedSeed}-counter`,
      loopTemplate: selectedTemplates[1],
      passThroughPoints,
      randomSeed: resolvedSeed,
      start: parsedRequest.start,
      strategy: "triangle_counter_clockwise",
      targetDistanceMeters,
      targetDistanceKm: parsedRequest.targetDistanceKm,
    }),
  ];
}

function buildRouteCandidateWaypointSeed(options: {
  id: string;
  loopTemplate: OrbitLoopTemplate;
  passThroughPoints: Coordinate[];
  randomSeed: string;
  start: Coordinate;
  strategy: RouteCandidateWaypointSeed["strategy"];
  targetDistanceMeters: number;
  targetDistanceKm: number;
}): RouteCandidateWaypointSeed {
  const loopRadiusMeters = clamp(
    options.targetDistanceMeters * options.loopTemplate.radiusFactor,
    MIN_LOOP_RADIUS_METERS,
    MAX_LOOP_RADIUS_METERS,
  );
  const loopCenter = projectCoordinate(
    options.start,
    loopRadiusMeters * options.loopTemplate.centerOffsetFactor,
    options.loopTemplate.baseBearingDegrees,
  );
  const orbitWaypoints = options.loopTemplate.orbitBearingOffsets.map(
    (bearingOffset) =>
      projectCoordinate(
        loopCenter,
        loopRadiusMeters,
        normalizeBearing(
          options.loopTemplate.baseBearingDegrees + bearingOffset,
        ),
      ),
  );
  const passThroughInsertIndex = Math.min(2, orbitWaypoints.length);

  return {
    id: options.id,
    points: [
      cloneCoordinate(options.start),
      ...orbitWaypoints.slice(0, passThroughInsertIndex),
      ...options.passThroughPoints,
      ...orbitWaypoints.slice(passThroughInsertIndex),
      cloneCoordinate(options.start),
    ],
    randomSeed: options.randomSeed,
    strategy: options.strategy,
    targetDistanceKm: options.targetDistanceKm,
  };
}

function selectOrbitLoopTemplates(
  random: () => number,
): [OrbitLoopTemplate, OrbitLoopTemplate] {
  const remainingTemplates = [...ORBIT_LOOP_TEMPLATES];
  const selectedTemplates: OrbitLoopTemplate[] = [];

  while (selectedTemplates.length < 2) {
    const selectedIndex = Math.floor(random() * remainingTemplates.length);
    const [selectedTemplate] = remainingTemplates.splice(selectedIndex, 1);

    if (!selectedTemplate) {
      throw new RangeError(
        "Route loop template selection exhausted before producing two candidates.",
      );
    }

    selectedTemplates.push(selectedTemplate);
  }

  const [firstTemplate, secondTemplate] = selectedTemplates;

  if (!firstTemplate || !secondTemplate) {
    throw new RangeError(
      "Route loop template selection must resolve exactly two candidates.",
    );
  }

  return [firstTemplate, secondTemplate];
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
