import {
  routeGenerateRequestSchema,
  routeGenerateResponseSchema,
} from "@pathbadger/shared";
import type {
  RouteGenerateRequest,
  RouteGenerateResponse,
  RouteWarning,
} from "@pathbadger/shared";

import { createRouteCandidateWaypointSeeds } from "./candidate-waypoint-seeds.js";
import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
} from "./graphhopper-adapter.js";
import type { RoutingEngineAdapter } from "./graphhopper-adapter.js";

export interface RouteGenerationService {
  generateRoute(request: RouteGenerateRequest): Promise<RouteGenerateResponse>;
}

export interface CreateRouteGenerationServiceOptions {
  routingEngine: RoutingEngineAdapter;
}

export function createRouteGenerationService(
  options: CreateRouteGenerationServiceOptions,
): RouteGenerationService {
  return {
    async generateRoute(request) {
      const parsedRequest = routeGenerateRequestSchema.parse(request);
      const [candidate] = createRouteCandidateWaypointSeeds(parsedRequest);

      if (!candidate) {
        return routeGenerateResponseSchema.parse({
          routeId: "unavailable-candidate",
          status: "failed",
          warnings: [
            {
              code: "candidate_generation_failed",
              message:
                "No route candidate could be generated for this request.",
            },
          ],
          summary: null,
          geometry: null,
        });
      }

      try {
        const routedCandidate = await options.routingEngine.getRoute({
          points: candidate.points,
          activity: parsedRequest.activity,
        });
        const targetDistanceMeters = parsedRequest.targetDistanceKm * 1_000;
        const distanceDeltaMeters = Math.round(
          routedCandidate.distanceMeters - targetDistanceMeters,
        );
        const warnings = createSuccessWarnings({
          distanceDeltaMeters,
          surfacePreference: parsedRequest.surfacePreference,
          toleranceMeters: parsedRequest.toleranceMeters,
        });
        const status = warnings.length > 0 ? "partial" : "success";

        return routeGenerateResponseSchema.parse({
          routeId: candidate.id,
          status,
          warnings,
          summary: {
            totalDistanceKm: roundKilometers(routedCandidate.distanceMeters),
            targetDistanceKm: parsedRequest.targetDistanceKm,
            distanceDeltaMeters,
            elevationGainMeters: routedCandidate.elevationGainMeters,
            surface: {
              asphaltPercent: null,
              trailUnpavedPercent: null,
              fieldTrackOtherPercent: null,
              unknownPercent: null,
            },
          },
          geometry: routedCandidate.geometry,
        });
      } catch (error) {
        return routeGenerateResponseSchema.parse(
          mapFailureToResponse(candidate.id, error),
        );
      }
    },
  };
}

function createSuccessWarnings(options: {
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

function mapFailureToResponse(routeId: string, error: unknown) {
  if (error instanceof GraphHopperUnavailableError) {
    return createFailedRouteResponse(
      routeId,
      "routing_engine_unavailable",
      error.message,
    );
  }

  if (error instanceof GraphHopperInvalidResponseError) {
    return createFailedRouteResponse(
      routeId,
      "invalid_routing_response",
      error.message,
    );
  }

  return createFailedRouteResponse(
    routeId,
    "route_generation_failed",
    "Route generation failed unexpectedly before a preview was available.",
  );
}

function createFailedRouteResponse(
  routeId: string,
  code: string,
  message: string,
) {
  return {
    routeId,
    status: "failed" as const,
    warnings: [
      {
        code,
        message,
      },
    ],
    summary: null,
    geometry: null,
  };
}

function roundKilometers(distanceMeters: number) {
  return Number((distanceMeters / 1_000).toFixed(2));
}
