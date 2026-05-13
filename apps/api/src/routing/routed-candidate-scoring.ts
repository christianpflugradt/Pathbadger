import {
  routeGenerateRequestSchema,
  routeSummarySchema,
} from "@pathbadger/shared";
import type {
  RouteGenerateRequest,
  RouteGeometry,
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

export interface RoutedCandidateForScoring extends GraphHopperRouteResult {
  routeId: string;
}

export interface ScoredRoutedCandidate {
  routeId: string;
  score: number;
  distanceFitScore: number;
  surfacePreferenceScore: number;
  isWithinTolerance: boolean;
  status: Exclude<RouteStatus, "failed">;
  warnings: RouteWarning[];
  summary: RouteSummary;
  geometry: RouteGeometry;
}

export interface ScoreRoutedCandidateOptions {
  request: RouteGenerateRequest;
  candidate: RoutedCandidateForScoring;
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
    surfaceSummary,
    toleranceMeters: parsedRequest.toleranceMeters,
  });
  const summary = routeSummarySchema.parse({
    totalDistanceKm: roundKilometers(options.candidate.distanceMeters),
    targetDistanceKm: parsedRequest.targetDistanceKm,
    distanceDeltaMeters,
    elevationGainMeters: options.candidate.elevationGainMeters,
    surface: surfaceSummary,
  });

  return {
    routeId: options.candidate.routeId,
    score: distanceFitScore + surfacePreferenceScore,
    distanceFitScore,
    surfacePreferenceScore,
    isWithinTolerance,
    status: warnings.length > 0 ? "partial" : "success",
    warnings,
    summary,
    geometry: options.candidate.geometry,
  };
}

function createScoringWarnings(options: {
  distanceDeltaMeters: number;
  surfaceSummary: RouteSurfaceSummary;
  toleranceMeters: number;
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

  return warnings;
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
