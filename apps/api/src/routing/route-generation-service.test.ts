import { describe, expect, it, vi } from "vitest";

import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
} from "./graphhopper-adapter.js";
import { createRouteGenerationService } from "./route-generation-service.js";

describe("createRouteGenerationService", () => {
  it("returns a successful routed preview when the route fits the request", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi.fn().mockResolvedValue({
          distanceMeters: 12_040,
          durationMs: 4_920_000,
          elevationGainMeters: 88,
          geometry: {
            type: "LineString",
            coordinates: [
              [10.1228, 54.3233],
              [10.1452, 54.3321],
              [10.1228, 54.3233],
            ],
          },
        }),
      },
    });

    const response = await service.generateRoute({
      activity: "running_walking",
      passThroughPoints: [{ lat: 54.3321, lon: 10.1452 }],
      randomSeed: "preview-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "indifferent",
      targetDistanceKm: 12,
      toleranceMeters: 150,
    });

    expect(response).toEqual({
      routeId: "preview-seed-clockwise",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 12.04,
        targetDistanceKm: 12,
        distanceDeltaMeters: 40,
        elevationGainMeters: 88,
        surface: {
          asphaltPercent: null,
          trailUnpavedPercent: null,
          fieldTrackOtherPercent: null,
          unknownPercent: null,
        },
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.1228, 54.3233],
          [10.1452, 54.3321],
          [10.1228, 54.3233],
        ],
      },
    });
  });

  it("returns a partial routed preview with honest warnings when fit is incomplete", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi.fn().mockResolvedValue({
          distanceMeters: 12_340,
          durationMs: 4_920_000,
          elevationGainMeters: 88,
          geometry: {
            type: "LineString",
            coordinates: [
              [10.1228, 54.3233],
              [10.152, 54.3375],
              [10.1228, 54.3233],
            ],
          },
        }),
      },
    });

    const response = await service.generateRoute({
      activity: "running_walking",
      passThroughPoints: [],
      randomSeed: "warning-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "trail",
      targetDistanceKm: 12,
      toleranceMeters: 150,
    });

    expect(response.status).toBe("partial");
    expect(response.warnings).toEqual([
      {
        code: "distance_outside_tolerance",
        message:
          "The first routed preview is outside the requested distance tolerance.",
      },
      {
        code: "surface_preference_pending",
        message:
          "Surface preference is not applied yet in the first routed preview.",
      },
    ]);
    expect(response.summary?.distanceDeltaMeters).toBe(340);
  });

  it("maps unavailable routing-engine failures into a failed response", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi
          .fn()
          .mockRejectedValue(
            new GraphHopperUnavailableError(
              "GraphHopper returned 503 for route requests.",
              503,
            ),
          ),
      },
    });

    await expect(
      service.generateRoute({
        activity: "cycling",
        passThroughPoints: [],
        randomSeed: "failure-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 20,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "failure-seed-clockwise",
      status: "failed",
      warnings: [
        {
          code: "routing_engine_unavailable",
          message: "GraphHopper returned 503 for route requests.",
        },
      ],
      summary: null,
      geometry: null,
    });
  });

  it("maps malformed routing-engine data into a failed response", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi
          .fn()
          .mockRejectedValue(
            new GraphHopperInvalidResponseError(
              "GraphHopper returned an unexpected route payload.",
            ),
          ),
      },
    });

    const response = await service.generateRoute({
      activity: "cycling",
      passThroughPoints: [],
      randomSeed: "invalid-response-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "mixed",
      targetDistanceKm: 20,
      toleranceMeters: 150,
    });

    expect(response).toEqual({
      routeId: "invalid-response-seed-clockwise",
      status: "failed",
      warnings: [
        {
          code: "invalid_routing_response",
          message: "GraphHopper returned an unexpected route payload.",
        },
      ],
      summary: null,
      geometry: null,
    });
  });
});
