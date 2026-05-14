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
import {
  findKnownLegalityWarning,
  type RoutedCandidateForScoring,
  scoreRoutedCandidate,
} from "./routed-candidate-scoring.js";
import {
  DEFAULT_SUPPORTED_REGION_NAME,
  createSchleswigHolsteinSupportedRegion,
} from "./supported-region.js";
import type { SupportedRegion } from "./supported-region.js";

export interface RouteGenerationService {
  generateRoute(request: RouteGenerateRequest): Promise<RouteGenerateResponse>;
}

export interface CreateRouteGenerationServiceOptions {
  routingEngine: RoutingEngineAdapter;
  supportedRegion?: SupportedRegion;
}

export function createRouteGenerationService(
  options: CreateRouteGenerationServiceOptions,
): RouteGenerationService {
  const supportedRegion =
    options.supportedRegion ??
    createSchleswigHolsteinSupportedRegion(
      process.env.REGION_NAME ?? DEFAULT_SUPPORTED_REGION_NAME,
    );

  return {
    async generateRoute(request) {
      const parsedRequest = routeGenerateRequestSchema.parse(request);
      const requestRegionWarning = findRequestRegionWarning(
        parsedRequest,
        supportedRegion,
      );

      if (requestRegionWarning) {
        return routeGenerateResponseSchema.parse(
          createFailedRouteResponse(
            "unsupported-region-request",
            requestRegionWarning.code,
            requestRegionWarning.message,
          ),
        );
      }

      const candidates = createRouteCandidateWaypointSeeds(parsedRequest);
      const scoredCandidates = [];
      const failures = [];
      const rejections = [];

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
          const candidateWithRouteId = {
            routeId: candidate.id,
            ...routedCandidate,
          };
          const regionWarning = findRouteRegionWarning(
            candidateWithRouteId,
            supportedRegion,
          );

          if (regionWarning) {
            rejections.push({
              routeId: candidate.id,
              warning: regionWarning,
            });
            continue;
          }

          const legalityWarning = findKnownLegalityWarning({
            request: parsedRequest,
            candidate: candidateWithRouteId,
          });

          if (legalityWarning) {
            rejections.push({
              routeId: candidate.id,
              warning: legalityWarning,
            });
            continue;
          }

          const scoredCandidate = scoreRoutedCandidate({
            request: parsedRequest,
            candidate: candidateWithRouteId,
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
      const [firstRejection] = rejections;

      return routeGenerateResponseSchema.parse(
        firstRejection
          ? createFailedRouteResponse(
              firstRejection.routeId,
              firstRejection.warning.code,
              firstRejection.warning.message,
            )
          : firstFailure
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

function findRequestRegionWarning(
  request: RouteGenerateRequest,
  supportedRegion: SupportedRegion,
) {
  if (!supportedRegion.containsCoordinate(request.start)) {
    return {
      code: "request_points_out_of_supported_region",
      message: `The requested start point is outside the supported ${supportedRegion.name} region.`,
    };
  }

  if (
    request.passThroughPoints.some(
      (passThroughPoint) =>
        !supportedRegion.containsCoordinate(passThroughPoint),
    )
  ) {
    return {
      code: "request_points_out_of_supported_region",
      message: `A requested pass-through point is outside the supported ${supportedRegion.name} region.`,
    };
  }

  return null;
}

function findRouteRegionWarning(
  candidate: RoutedCandidateForScoring,
  supportedRegion: SupportedRegion,
) {
  if (supportedRegion.containsRouteGeometry(candidate.geometry)) {
    return null;
  }

  return {
    code: "route_leaves_supported_region",
    message: `GraphHopper returned a routed preview that leaves the supported ${supportedRegion.name} region.`,
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
