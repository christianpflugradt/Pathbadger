import {
  routeGenerateRequestSchema,
  routeSummarySchema,
} from "@pathbadger/shared";
import type {
  RouteGenerateRequest,
  RouteGeometry,
  RouteStatus,
  RouteSummary,
  RouteWarning,
} from "@pathbadger/shared";

import type { GraphHopperRouteResult } from "./graphhopper-adapter.js";

export interface RoutedCandidateForScoring extends GraphHopperRouteResult {
  routeId: string;
}

export interface ScoredRoutedCandidate {
  routeId: string;
  score: number;
  distanceFitScore: number;
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
  const warnings = createScoringWarnings({
    distanceDeltaMeters,
    surfacePreference: parsedRequest.surfacePreference,
    toleranceMeters: parsedRequest.toleranceMeters,
  });
  const summary = routeSummarySchema.parse({
    totalDistanceKm: roundKilometers(options.candidate.distanceMeters),
    targetDistanceKm: parsedRequest.targetDistanceKm,
    distanceDeltaMeters,
    elevationGainMeters: options.candidate.elevationGainMeters,
    surface: {
      asphaltPercent: null,
      trailUnpavedPercent: null,
      fieldTrackOtherPercent: null,
      unknownPercent: null,
    },
  });
  const distanceFitScore = -Math.abs(distanceDeltaMeters);

  return {
    routeId: options.candidate.routeId,
    score: distanceFitScore,
    distanceFitScore,
    isWithinTolerance,
    status: warnings.length > 0 ? "partial" : "success",
    warnings,
    summary,
    geometry: options.candidate.geometry,
  };
}

function createScoringWarnings(options: {
  distanceDeltaMeters: number;
  surfacePreference: RouteGenerateRequest["surfacePreference"];
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

  if (options.surfacePreference !== "indifferent") {
    warnings.push({
      code: "surface_preference_pending",
      message:
        "Surface preference is not applied yet in the first routed preview.",
    });
  }

  return warnings;
}

function roundKilometers(distanceMeters: number) {
  return Number((distanceMeters / 1_000).toFixed(2));
}
