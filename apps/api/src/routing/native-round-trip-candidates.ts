import { routeGenerateRequestSchema } from "@pathbadger/shared";
import type { RouteGenerateRequest } from "@pathbadger/shared";

const NATIVE_ROUND_TRIP_SEED_VARIATIONS = 4;

type NativeRoundTripTemplate = {
  distanceFactor: number;
  pointCount: number;
};

const NATIVE_ROUND_TRIP_TEMPLATES: readonly NativeRoundTripTemplate[] = [
  { distanceFactor: 0.85, pointCount: 4 },
  { distanceFactor: 1, pointCount: 4 },
  { distanceFactor: 0.8, pointCount: 5 },
  { distanceFactor: 0.9, pointCount: 3 },
  { distanceFactor: 1, pointCount: 3 },
  { distanceFactor: 1.05, pointCount: 2 },
] as const;

export interface NativeRoundTripCandidateRequest {
  id: string;
  pointCount: number;
  roundTripDistanceMeters: number;
  roundTripSeed: number;
}

export function createNativeRoundTripCandidateRequests(
  request: RouteGenerateRequest,
): NativeRoundTripCandidateRequest[] {
  const parsedRequest = routeGenerateRequestSchema.parse(request);
  const resolvedSeed =
    parsedRequest.randomSeed ?? createFallbackSeed(parsedRequest);
  const templateRandom = createSeededRandom(
    `${resolvedSeed}:native-template-order`,
  );
  const orderedTemplates = seededShuffle(
    [...NATIVE_ROUND_TRIP_TEMPLATES],
    templateRandom,
  );

  return Array.from(
    { length: NATIVE_ROUND_TRIP_SEED_VARIATIONS },
    (_, variationIndex) => variationIndex + 1,
  ).flatMap((variationIndex) =>
    orderedTemplates.map((template) => ({
      id: `${resolvedSeed}-native-p${template.pointCount}-f${formatDistanceFactor(
        template.distanceFactor,
      )}-v${variationIndex}`,
      pointCount: template.pointCount,
      roundTripDistanceMeters: Math.max(
        1,
        Math.round(
          parsedRequest.targetDistanceKm * 1_000 * template.distanceFactor,
        ),
      ),
      roundTripSeed: createPositiveIntegerSeed(
        `${resolvedSeed}:native:${template.pointCount}:${template.distanceFactor}:${variationIndex}`,
      ),
    })),
  );
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

function createPositiveIntegerSeed(seed: string) {
  let hash = 2_166_136_261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  const positiveInteger = (hash >>> 0) % 2_147_483_647;

  return positiveInteger === 0 ? 1 : positiveInteger;
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

function seededShuffle<T>(items: T[], random: () => number) {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentItem = shuffledItems[index];
    const swapItem = shuffledItems[swapIndex];

    if (currentItem === undefined || swapItem === undefined) {
      continue;
    }

    shuffledItems[index] = swapItem;
    shuffledItems[swapIndex] = currentItem;
  }

  return shuffledItems;
}

function formatDistanceFactor(value: number) {
  return value.toFixed(2).replace(".", "");
}
