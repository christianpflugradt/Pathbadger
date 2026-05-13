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
      const candidates = createRouteCandidateWaypointSeeds(parsedRequest);
      const scoredCandidates = [];
      const failures = [];

      if (candidates.length === 0) {
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

      for (const candidate of candidates) {
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

          scoredCandidates.push(scoredCandidate);
        } catch (error) {
          failures.push({
            error,
            routeId: candidate.id,
          });
        }
      }

      const bestScoredCandidate = selectBestScoredCandidate(scoredCandidates);

      if (bestScoredCandidate) {
        return routeGenerateResponseSchema.parse(
          buildRouteResponse(bestScoredCandidate),
        );
      }

      const [firstFailure] = failures;

      return routeGenerateResponseSchema.parse(
        firstFailure
          ? mapFailureToResponse(firstFailure.routeId, firstFailure.error)
          : createFailedRouteResponse(
              "unavailable-candidate",
              "route_generation_failed",
              "Route generation failed before a scored preview was available.",
            ),
      );
    },
  };
}

function buildRouteResponse(
  scoredCandidate: ReturnType<typeof scoreRoutedCandidate>,
) {
  return {
    routeId: scoredCandidate.routeId,
    status: scoredCandidate.status,
    warnings: scoredCandidate.warnings,
    summary: scoredCandidate.summary,
    geometry: scoredCandidate.geometry,
    instructions: scoredCandidate.instructions,
  };
}

function selectBestScoredCandidate(
  scoredCandidates: Array<ReturnType<typeof scoreRoutedCandidate>>,
) {
  return scoredCandidates.reduce<ReturnType<
    typeof scoreRoutedCandidate
  > | null>((bestCandidate, currentCandidate) => {
    if (!bestCandidate) {
      return currentCandidate;
    }

    if (currentCandidate.score > bestCandidate.score) {
      return currentCandidate;
    }

    if (
      currentCandidate.score === bestCandidate.score &&
      currentCandidate.warnings.length < bestCandidate.warnings.length
    ) {
      return currentCandidate;
    }

    return bestCandidate;
  }, null);
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
    "Route generation failed unexpectedly before a scored preview was available.",
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
    instructions: null,
  };
}
