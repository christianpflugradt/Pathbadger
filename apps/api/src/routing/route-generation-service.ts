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
  MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS,
  type ScoredRoutedCandidate,
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
  automaticCandidateRetryCount?: number;
  automaticCandidateSearchBudgetMs?: number;
  nowMs?: () => number;
  routingEngine: RoutingEngineAdapter;
  supportedRegion?: SupportedRegion;
}

const DISTANCE_FIT_FALLBACK_FACTORS = [0.85, 0.75, 0.6875, 0.6];
const DEFAULT_AUTOMATIC_CANDIDATE_RETRY_COUNT = 1_000;
const DEFAULT_AUTOMATIC_CANDIDATE_SEARCH_BUDGET_MS = 10_000;
const SUPPORTED_ROUND_TRIP_CONTRACT_DESCRIPTION =
  "returned to the start without turning around on itself and with a meaningful loop beyond any shared connector";

export function createRouteGenerationService(
  options: CreateRouteGenerationServiceOptions,
): RouteGenerationService {
  const supportedRegion =
    options.supportedRegion ??
    createSchleswigHolsteinSupportedRegion(
      process.env.REGION_NAME ?? DEFAULT_SUPPORTED_REGION_NAME,
    );
  const automaticCandidateRetryCount =
    options.automaticCandidateRetryCount ??
    DEFAULT_AUTOMATIC_CANDIDATE_RETRY_COUNT;
  const automaticCandidateSearchBudgetMs =
    options.automaticCandidateSearchBudgetMs ??
    DEFAULT_AUTOMATIC_CANDIDATE_SEARCH_BUDGET_MS;
  const nowMs = options.nowMs ?? Date.now;

  return {
    async generateRoute(request) {
      const parsedRequest = routeGenerateRequestSchema.parse(request);
      const candidateSearchDeadlineMs =
        nowMs() + automaticCandidateSearchBudgetMs;
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

      const unsupportedCandidates: ScoredRoutedCandidate[] = [];
      const primaryAttempt = await evaluateCandidateRequest({
        generationRequest: parsedRequest,
        routingEngine: options.routingEngine,
        scoringRequest: parsedRequest,
        supportedRegion,
      });

      failures.push(...primaryAttempt.failures);
      rejections.push(...primaryAttempt.rejections);
      unsupportedCandidates.push(...primaryAttempt.unsupportedCandidates);

      const bestScoredCandidate = selectBestScoredCandidate(
        primaryAttempt.acceptableCandidates,
      );

      if (bestScoredCandidate) {
        return routeGenerateResponseSchema.parse(
          buildRouteResponse(bestScoredCandidate),
        );
      }

      if (
        shouldRetryAutomaticCandidateSeeds(parsedRequest, primaryAttempt) &&
        hasCandidateSearchBudgetRemaining(candidateSearchDeadlineMs, nowMs)
      ) {
        for (const retryRequest of createAutomaticCandidateRetryRequests(
          parsedRequest,
          automaticCandidateRetryCount,
        )) {
          if (
            !hasCandidateSearchBudgetRemaining(candidateSearchDeadlineMs, nowMs)
          ) {
            break;
          }

          const retryAttempt = await evaluateCandidateRequest({
            generationRequest: retryRequest,
            routingEngine: options.routingEngine,
            scoringRequest: parsedRequest,
            supportedRegion,
          });

          failures.push(...retryAttempt.failures);
          rejections.push(...retryAttempt.rejections);
          unsupportedCandidates.push(...retryAttempt.unsupportedCandidates);

          const bestRetryCandidate = selectBestScoredCandidate(
            retryAttempt.acceptableCandidates,
          );

          if (bestRetryCandidate) {
            return routeGenerateResponseSchema.parse(
              buildRouteResponse(bestRetryCandidate),
            );
          }
        }
      }

      if (
        unsupportedCandidates.length > 0 &&
        hasCandidateSearchBudgetRemaining(candidateSearchDeadlineMs, nowMs)
      ) {
        for (const fallbackRequest of createDistanceFitFallbackRequests(
          parsedRequest,
        )) {
          if (
            !hasCandidateSearchBudgetRemaining(candidateSearchDeadlineMs, nowMs)
          ) {
            break;
          }

          const fallbackAttempt = await evaluateCandidateRequest({
            generationRequest: fallbackRequest,
            routingEngine: options.routingEngine,
            scoringRequest: parsedRequest,
            supportedRegion,
          });

          failures.push(...fallbackAttempt.failures);
          rejections.push(...fallbackAttempt.rejections);
          unsupportedCandidates.push(...fallbackAttempt.unsupportedCandidates);

          const bestFallbackCandidate = selectBestScoredCandidate(
            fallbackAttempt.acceptableCandidates,
          );

          if (bestFallbackCandidate) {
            return routeGenerateResponseSchema.parse(
              buildRouteResponse(bestFallbackCandidate),
            );
          }
        }

        return routeGenerateResponseSchema.parse(
          createUnsupportedCandidateFailureResponse({
            request: parsedRequest,
            rejections,
            unsupportedCandidates,
          }),
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

async function evaluateCandidateRequest(options: {
  generationRequest: RouteGenerateRequest;
  routingEngine: RoutingEngineAdapter;
  scoringRequest: RouteGenerateRequest;
  supportedRegion: SupportedRegion;
}) {
  const acceptableCandidates: ScoredRoutedCandidate[] = [];
  const unsupportedCandidates: ScoredRoutedCandidate[] = [];
  const failures: Array<{ error: unknown; routeId: string }> = [];
  const rejections: Array<{
    routeId: string;
    warning: { code: string; message: string };
  }> = [];

  for (const candidate of createRouteCandidateWaypointSeeds(
    options.generationRequest,
  )) {
    try {
      const routedCandidate = await options.routingEngine.getRoute({
        points: candidate.points,
        activity: options.generationRequest.activity,
      });
      const candidateWithRouteId = {
        routeId: candidate.id,
        ...routedCandidate,
      };
      const regionWarning = findRouteRegionWarning(
        candidateWithRouteId,
        options.supportedRegion,
      );

      if (regionWarning) {
        rejections.push({
          routeId: candidate.id,
          warning: regionWarning,
        });
        continue;
      }

      const legalityWarning = findKnownLegalityWarning({
        request: options.scoringRequest,
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
        request: options.scoringRequest,
        candidate: candidateWithRouteId,
      });

      if (
        scoredCandidate.isWithinSupportedDistanceLimit &&
        scoredCandidate.isWithinSupportedRoundTripContract
      ) {
        acceptableCandidates.push(scoredCandidate);
      } else {
        unsupportedCandidates.push(scoredCandidate);
      }
    } catch (error) {
      failures.push({
        error,
        routeId: candidate.id,
      });
    }
  }

  return {
    acceptableCandidates,
    failures,
    rejections,
    unsupportedCandidates,
  };
}

function hasCandidateSearchBudgetRemaining(
  deadlineMs: number,
  nowMs: () => number,
) {
  return nowMs() < deadlineMs;
}

function createAutomaticCandidateRetryRequests(
  request: RouteGenerateRequest,
  automaticCandidateRetryCount: number,
) {
  return Array.from({ length: automaticCandidateRetryCount }, (_, index) =>
    routeGenerateRequestSchema.parse({
      ...request,
      randomSeed: `draft-variation-${index + 1}`,
    }),
  );
}

function shouldRetryAutomaticCandidateSeeds(
  request: RouteGenerateRequest,
  attempt: Awaited<ReturnType<typeof evaluateCandidateRequest>>,
) {
  if (request.randomSeed !== null) {
    return false;
  }

  return attempt.unsupportedCandidates.some(
    (candidate) => candidate.isWithinSupportedDistanceLimit,
  );
}

function createDistanceFitFallbackRequests(request: RouteGenerateRequest) {
  return DISTANCE_FIT_FALLBACK_FACTORS.map((factor) =>
    routeGenerateRequestSchema.parse({
      ...request,
      targetDistanceKm: roundTargetDistance(request.targetDistanceKm * factor),
    }),
  );
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

function selectBestScoredCandidate(scoredCandidates: ScoredRoutedCandidate[]) {
  return scoredCandidates.reduce<ScoredRoutedCandidate | null>(
    (bestCandidate, currentCandidate) => {
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
    },
    null,
  );
}

function roundTargetDistance(distanceKm: number) {
  return Number(distanceKm.toFixed(3));
}

function createUnsupportedCandidateFailureResponse(options: {
  request: RouteGenerateRequest;
  rejections: Array<{
    routeId: string;
    warning: { code: string; message: string };
  }>;
  unsupportedCandidates: ScoredRoutedCandidate[];
}) {
  const hasDistanceOnlyCandidates = options.unsupportedCandidates.some(
    (candidate) => candidate.isWithinSupportedRoundTripContract,
  );
  const hasLoopOnlyCandidates = options.unsupportedCandidates.some(
    (candidate) => candidate.isWithinSupportedDistanceLimit,
  );
  const hasRequestedPassThroughPoints =
    options.request.passThroughPoints.length > 0;
  const hasSupportedRoutingConstraintRejections = options.rejections.some(
    (rejection) =>
      rejection.warning.code === "route_contains_prohibited_access" ||
      rejection.warning.code === "route_contains_prohibited_road_class" ||
      rejection.warning.code === "route_leaves_supported_region",
  );
  const hasExplicitFeasibilityConstraints =
    hasRequestedPassThroughPoints || hasSupportedRoutingConstraintRejections;

  if (hasDistanceOnlyCandidates && hasLoopOnlyCandidates) {
    return createFailedRouteResponse(
      hasExplicitFeasibilityConstraints
        ? "route-contract-constraints-unavailable"
        : "route-contract-unavailable",
      hasExplicitFeasibilityConstraints
        ? "route_cannot_meet_requested_constraints"
        : "route_cannot_meet_supported_contract",
      hasExplicitFeasibilityConstraints
        ? createConstraintLimitedFailureMessage({
            hasRequestedPassThroughPoints,
            hasSupportedRoutingConstraintRejections,
            includesLoopConstraint: true,
          })
        : `No legal round course could be generated that both ${SUPPORTED_ROUND_TRIP_CONTRACT_DESCRIPTION} and stayed within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`,
    );
  }

  if (hasDistanceOnlyCandidates) {
    return createFailedRouteResponse(
      hasExplicitFeasibilityConstraints
        ? "distance-fit-constraints-unavailable"
        : "distance-fit-unavailable",
      hasExplicitFeasibilityConstraints
        ? "route_cannot_meet_requested_constraints"
        : "route_exceeds_supported_distance_limit",
      hasExplicitFeasibilityConstraints
        ? createConstraintLimitedFailureMessage({
            hasRequestedPassThroughPoints,
            hasSupportedRoutingConstraintRejections,
            includesLoopConstraint: false,
          })
        : `No legal round course could be generated within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`,
    );
  }

  return createFailedRouteResponse(
    "round-trip-unavailable",
    "route_cannot_form_supported_round_trip",
    `No legal round course could be generated that ${SUPPORTED_ROUND_TRIP_CONTRACT_DESCRIPTION}.`,
  );
}

function createConstraintLimitedFailureMessage(options: {
  hasRequestedPassThroughPoints: boolean;
  hasSupportedRoutingConstraintRejections: boolean;
  includesLoopConstraint: boolean;
}) {
  if (
    options.hasRequestedPassThroughPoints &&
    options.hasSupportedRoutingConstraintRejections
  ) {
    return options.includesLoopConstraint
      ? `No legal round course could include the requested pass-through points, honor supported routing constraints, ${SUPPORTED_ROUND_TRIP_CONTRACT_DESCRIPTION}, and stay within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`
      : `No legal round course could include the requested pass-through points, honor supported routing constraints, and stay within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`;
  }

  if (options.hasRequestedPassThroughPoints) {
    return options.includesLoopConstraint
      ? `No legal round course could include the requested pass-through points while also ${SUPPORTED_ROUND_TRIP_CONTRACT_DESCRIPTION} and staying within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`
      : `No legal round course could include the requested pass-through points and stay within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`;
  }

  return options.includesLoopConstraint
    ? `No legal round course could satisfy the supported routing constraints while also ${SUPPORTED_ROUND_TRIP_CONTRACT_DESCRIPTION} and staying within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance.`
    : `No legal round course could stay within ${MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS} meters of the requested distance once supported routing constraints were applied.`;
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
