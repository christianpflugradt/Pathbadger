import {
  routeGenerateRequestSchema,
  routeSummarySchema,
} from "@pathbadger/shared";
import type {
  RouteGenerateRequest,
  RouteGeometry,
  RouteInstruction,
  RouteLoopSummary,
  RouteSurfaceSummary,
  RouteStatus,
  RouteSummary,
  RouteWarning,
  SurfacePreference,
} from "@pathbadger/shared";

import type {
  GraphHopperRouteResult,
  GraphHopperRouteSurfaceDetail,
} from "./graphhopper-adapter.js";
import {
  MINIMUM_MEANINGFUL_LOOP_CORE_METERS,
  MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS,
  MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS,
  MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS,
  calculateUniqueLoopCoreMeters,
  routeMeetsSupportedRoundTripContract,
  summarizeRouteLoop,
} from "./route-loop-analysis.js";

const ASPHALT_SURFACES = new Set([
  "asphalt",
  "concrete",
  "concrete:lanes",
  "concrete:plates",
  "paved",
  "paving_stones",
  "sett",
  "cobblestone",
]);
const TRAIL_UNPAVED_SURFACES = new Set([
  "clay",
  "compacted",
  "dirt",
  "earth",
  "fine_gravel",
  "grass",
  "grass_paver",
  "gravel",
  "ground",
  "mud",
  "pebblestone",
  "rock",
  "sand",
  "unpaved",
  "woodchips",
]);
const FIELD_TRACK_OTHER_ROAD_CLASSES = new Set([
  "bridleway",
  "cycleway",
  "footway",
  "path",
  "pedestrian",
  "steps",
  "track",
]);
const PROHIBITED_ACTIVITY_ROAD_CLASSES = new Set([
  "motorway",
  "motorway_link",
  "trunk",
  "trunk_link",
]);
const PROHIBITED_ACCESS_VALUES = new Set(["no", "private"]);
const U_TURN_INSTRUCTION_TYPES = new Set(["u_turn_left", "u_turn_right"]);
export const MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS = 400;

export interface RoutedCandidateForScoring extends GraphHopperRouteResult {
  routeId: string;
}

export interface ScoredRoutedCandidate {
  routeId: string;
  score: number;
  distanceFitScore: number;
  surfacePreferenceScore: number;
  isWithinTolerance: boolean;
  isWithinSupportedDistanceLimit: boolean;
  isWithinSupportedRoundTripContract: boolean;
  status: Exclude<RouteStatus, "failed">;
  warnings: RouteWarning[];
  summary: RouteSummary;
  geometry: RouteGeometry;
  instructions: RouteInstruction[];
}

export interface ScoreRoutedCandidateOptions {
  request: RouteGenerateRequest;
  candidate: RoutedCandidateForScoring;
}

export function findKnownLegalityWarning(
  options: ScoreRoutedCandidateOptions,
): RouteWarning | null {
  const parsedRequest = routeGenerateRequestSchema.parse(options.request);

  if (
    options.candidate.surfaceDetails.some((detail) => {
      const roadClass = normalizeCategoryToken(detail.roadClass);

      return roadClass
        ? PROHIBITED_ACTIVITY_ROAD_CLASSES.has(roadClass)
        : false;
    })
  ) {
    return {
      code: "route_contains_prohibited_road_class",
      message:
        "GraphHopper reported motorway or trunk segments that are unsuitable for the requested activity.",
    };
  }

  const hasProhibitedAccess = options.candidate.surfaceDetails.some(
    (detail) => {
      const modeAccess = normalizeCategoryToken(
        parsedRequest.activity === "cycling"
          ? detail.bikeAccess
          : detail.footAccess,
      );
      const modeRoadAccess = normalizeCategoryToken(
        parsedRequest.activity === "cycling"
          ? detail.bikeRoadAccess
          : detail.footRoadAccess,
      );

      return (
        (modeAccess ? PROHIBITED_ACCESS_VALUES.has(modeAccess) : false) ||
        (modeRoadAccess ? PROHIBITED_ACCESS_VALUES.has(modeRoadAccess) : false)
      );
    },
  );

  if (hasProhibitedAccess) {
    return {
      code: "route_contains_prohibited_access",
      message:
        parsedRequest.activity === "cycling"
          ? "GraphHopper reported bicycle or access restrictions that make this routed candidate unsuitable for cycling."
          : "GraphHopper reported foot or access restrictions that make this routed candidate unsuitable for running or walking.",
    };
  }

  return null;
}

export function scoreRoutedCandidate(
  options: ScoreRoutedCandidateOptions,
): ScoredRoutedCandidate {
  const parsedRequest = routeGenerateRequestSchema.parse(options.request);
  const distanceDeltaMeters = Math.round(
    options.candidate.distanceMeters - parsedRequest.targetDistanceKm * 1_000,
  );
  const isWithinTolerance =
    Math.abs(distanceDeltaMeters) <= parsedRequest.toleranceMeters;
  const isWithinSupportedDistanceLimit =
    Math.abs(distanceDeltaMeters) <= MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS;
  const loop = summarizeRouteLoop({
    geometry: options.candidate.geometry,
    requestedStart: parsedRequest.start,
  });
  const uniqueLoopCoreMeters = calculateUniqueLoopCoreMeters(
    options.candidate.geometry,
  );
  const hasExplicitUTurnInstruction = options.candidate.instructions.some(
    (instruction) => U_TURN_INSTRUCTION_TYPES.has(instruction.type),
  );
  const isWithinSupportedRoundTripContract =
    !hasExplicitUTurnInstruction &&
    (routeMeetsSupportedRoundTripContract(loop) ||
      supportsConnectorOutAndBackRoundTrip({
        loop,
        uniqueLoopCoreMeters,
      }));
  const surfaceSummary = summarizeRouteSurface(
    options.candidate.surfaceDetails,
    options.candidate.distanceMeters,
  );
  const surfacePreferenceScore = scoreSurfacePreference(
    parsedRequest.surfacePreference,
    surfaceSummary,
  );
  const distanceFitScore = -Math.abs(distanceDeltaMeters);
  const warnings = createScoringWarnings({
    distanceDeltaMeters,
    hasExplicitUTurnInstruction,
    isWithinSupportedRoundTripContract,
    loop,
    surfaceSummary,
    toleranceMeters: parsedRequest.toleranceMeters,
    uniqueLoopCoreMeters,
  });
  const summary = routeSummarySchema.parse({
    totalDistanceKm: roundKilometers(options.candidate.distanceMeters),
    targetDistanceKm: parsedRequest.targetDistanceKm,
    distanceDeltaMeters,
    elevationGainMeters: options.candidate.elevationGainMeters,
    loop,
    surface: surfaceSummary,
  });

  return {
    routeId: options.candidate.routeId,
    score: distanceFitScore + surfacePreferenceScore,
    distanceFitScore,
    surfacePreferenceScore,
    isWithinTolerance,
    isWithinSupportedDistanceLimit,
    isWithinSupportedRoundTripContract,
    status: warnings.length > 0 ? "partial" : "success",
    warnings,
    summary,
    geometry: options.candidate.geometry,
    instructions: options.candidate.instructions,
  };
}

function createScoringWarnings(options: {
  distanceDeltaMeters: number;
  hasExplicitUTurnInstruction: boolean;
  isWithinSupportedRoundTripContract: boolean;
  loop: RouteLoopSummary;
  surfaceSummary: RouteSurfaceSummary;
  toleranceMeters: number;
  uniqueLoopCoreMeters: number;
}): RouteWarning[] {
  const warnings: RouteWarning[] = [];

  if (Math.abs(options.distanceDeltaMeters) > options.toleranceMeters) {
    warnings.push({
      code: "distance_outside_tolerance",
      message:
        "The first routed preview is outside the requested distance tolerance.",
    });
  }

  if ((options.surfaceSummary.unknownPercent ?? 0) > 0) {
    warnings.push({
      code: "surface_data_incomplete",
      message: `Surface classification is incomplete for ${formatPercent(
        options.surfaceSummary.unknownPercent ?? 0,
      )} of this routed preview.`,
    });
  }

  if (!options.isWithinSupportedRoundTripContract) {
    if (options.hasExplicitUTurnInstruction) {
      warnings.push({
        code: "route_contains_u_turn",
        message:
          "The routed preview turns around on itself instead of reaching a meaningful loop.",
      });
    }

    if (
      options.loop.startOffsetMeters >
        MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS ||
      options.loop.endOffsetMeters >
        MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS ||
      options.loop.closureGapMeters > MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS
    ) {
      warnings.push({
        code: "route_does_not_return_to_start",
        message:
          "The routed preview does not return closely enough to the requested start area.",
      });
    }

    if (
      !options.hasExplicitUTurnInstruction &&
      options.loop.bidirectionalOverlapMeters >
        MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS
    ) {
      warnings.push({
        code: "route_reuses_too_much_path",
        message:
          options.uniqueLoopCoreMeters >= MINIMUM_MEANINGFUL_LOOP_CORE_METERS
            ? "The routed preview still reuses too much path in opposite directions after the loop core is removed."
            : "The routed preview reuses more than 500 meters of the same path in opposite directions without forming a meaningful loop beyond the shared connector.",
      });
    }
  }

  return warnings;
}

function supportsConnectorOutAndBackRoundTrip(options: {
  loop: RouteLoopSummary;
  uniqueLoopCoreMeters: number;
}) {
  return (
    options.loop.startOffsetMeters <=
      MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS &&
    options.loop.endOffsetMeters <=
      MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS &&
    options.loop.closureGapMeters <= MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS &&
    options.uniqueLoopCoreMeters >= MINIMUM_MEANINGFUL_LOOP_CORE_METERS
  );
}

function summarizeRouteSurface(
  surfaceDetails: GraphHopperRouteSurfaceDetail[],
  totalRouteDistanceMeters: number,
): RouteSurfaceSummary {
  const surfaceDistances = surfaceDetails.reduce(
    (distances, detail) => {
      const distanceMeters = Math.max(detail.distanceMeters, 0);

      switch (classifySurfaceDetail(detail)) {
        case "asphalt":
          distances.asphaltMeters += distanceMeters;
          break;
        case "trail_unpaved":
          distances.trailUnpavedMeters += distanceMeters;
          break;
        case "field_track_other":
          distances.fieldTrackOtherMeters += distanceMeters;
          break;
        case "unknown":
          distances.unknownMeters += distanceMeters;
          break;
      }

      return distances;
    },
    {
      asphaltMeters: 0,
      trailUnpavedMeters: 0,
      fieldTrackOtherMeters: 0,
      unknownMeters: 0,
    },
  );
  const summarizedDistanceMeters =
    surfaceDistances.asphaltMeters +
    surfaceDistances.trailUnpavedMeters +
    surfaceDistances.fieldTrackOtherMeters +
    surfaceDistances.unknownMeters;
  const normalizationDistanceMeters =
    summarizedDistanceMeters === 0
      ? totalRouteDistanceMeters
      : Math.max(totalRouteDistanceMeters, summarizedDistanceMeters);

  if (normalizationDistanceMeters > summarizedDistanceMeters) {
    surfaceDistances.unknownMeters +=
      normalizationDistanceMeters - summarizedDistanceMeters;
  }

  return {
    asphaltPercent: toPercent(
      surfaceDistances.asphaltMeters,
      normalizationDistanceMeters,
    ),
    trailUnpavedPercent: toPercent(
      surfaceDistances.trailUnpavedMeters,
      normalizationDistanceMeters,
    ),
    fieldTrackOtherPercent: toPercent(
      surfaceDistances.fieldTrackOtherMeters,
      normalizationDistanceMeters,
    ),
    unknownPercent: toPercent(
      surfaceDistances.unknownMeters,
      normalizationDistanceMeters,
    ),
  };
}

function classifySurfaceDetail(detail: GraphHopperRouteSurfaceDetail) {
  const surface = normalizeCategoryToken(detail.surface);

  if (surface && ASPHALT_SURFACES.has(surface)) {
    return "asphalt" as const;
  }

  if (surface && TRAIL_UNPAVED_SURFACES.has(surface)) {
    return "trail_unpaved" as const;
  }

  const roadClass = normalizeCategoryToken(detail.roadClass);

  if (roadClass && FIELD_TRACK_OTHER_ROAD_CLASSES.has(roadClass)) {
    return "field_track_other" as const;
  }

  if (surface) {
    return "field_track_other" as const;
  }

  return "unknown" as const;
}

function scoreSurfacePreference(
  surfacePreference: SurfacePreference,
  surfaceSummary: RouteSurfaceSummary,
) {
  const asphaltPercent = surfaceSummary.asphaltPercent ?? 0;
  const trailUnpavedPercent = surfaceSummary.trailUnpavedPercent ?? 0;
  const fieldTrackOtherPercent = surfaceSummary.fieldTrackOtherPercent ?? 0;
  const unknownPercent = surfaceSummary.unknownPercent ?? 0;

  if (surfacePreference === "trail") {
    return (
      trailUnpavedPercent * 3 +
      fieldTrackOtherPercent -
      asphaltPercent * 2 -
      unknownPercent
    );
  }

  if (surfacePreference === "asphalt") {
    return (
      asphaltPercent * 3 +
      fieldTrackOtherPercent * 0.5 -
      trailUnpavedPercent * 2 -
      unknownPercent
    );
  }

  if (surfacePreference === "mixed") {
    return (
      Math.min(asphaltPercent, trailUnpavedPercent) * 2 +
      fieldTrackOtherPercent -
      Math.abs(asphaltPercent - trailUnpavedPercent) -
      unknownPercent
    );
  }

  return 0;
}

function normalizeCategoryToken(value: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function toPercent(distanceMeters: number, totalDistanceMeters: number) {
  if (totalDistanceMeters <= 0) {
    return 0;
  }

  return Number(((distanceMeters / totalDistanceMeters) * 100).toFixed(1));
}

function formatPercent(value: number) {
  return Number(value.toFixed(1)).toString() + "%";
}

function roundKilometers(distanceMeters: number) {
  return Number((distanceMeters / 1_000).toFixed(2));
}
