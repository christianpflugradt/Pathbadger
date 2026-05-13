import {
  routeGenerateRequestSchema,
  routeGenerateResponseSchema,
} from "@pathbadger/shared";
import type {
  RouteGenerateRequest,
  RouteGenerateResponse,
} from "@pathbadger/shared";

import { createRouteCandidateWaypointSeeds } from "./candidate-waypoint-seeds.js";
import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
} from "./graphhopper-adapter.js";
import type { RoutingEngineAdapter } from "./graphhopper-adapter.js";
import { scoreRoutedCandidate } from "./routed-candidate-scoring.js";

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
        const scoredCandidate = scoreRoutedCandidate({
          request: parsedRequest,
          candidate: {
            routeId: candidate.id,
            ...routedCandidate,
          },
        });

        return routeGenerateResponseSchema.parse({
          routeId: scoredCandidate.routeId,
          status: scoredCandidate.status,
          warnings: scoredCandidate.warnings,
          summary: scoredCandidate.summary,
          geometry: scoredCandidate.geometry,
        });
      } catch (error) {
        return routeGenerateResponseSchema.parse(
          mapFailureToResponse(candidate.id, error),
        );
      }
    },
  };
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
