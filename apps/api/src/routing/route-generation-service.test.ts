import { describe, expect, it, vi } from "vitest";

import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
} from "./graphhopper-adapter.js";
import { createRouteGenerationService } from "./route-generation-service.js";

function createUnknownSurfaceDetails(distanceMeters: number) {
  return [
    {
      distanceMeters,
      surface: null,
      roadClass: null,
    },
  ];
}

describe("createRouteGenerationService", () => {
  it("returns a successful routed preview when the best routed candidate fits the request", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi
          .fn()
          .mockResolvedValueOnce({
            distanceMeters: 12_240,
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
            surfaceDetails: createUnknownSurfaceDetails(12_240),
          })
          .mockResolvedValueOnce({
            distanceMeters: 12_040,
            durationMs: 4_910_000,
            elevationGainMeters: 82,
            geometry: {
              type: "LineString",
              coordinates: [
                [10.1228, 54.3233],
                [10.141, 54.332],
                [10.1228, 54.3233],
              ],
            },
            surfaceDetails: createUnknownSurfaceDetails(12_040),
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
      routeId: "preview-seed-counter",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 12.04,
        targetDistanceKm: 12,
        distanceDeltaMeters: 40,
        elevationGainMeters: 82,
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
          [10.141, 54.332],
          [10.1228, 54.3233],
        ],
      },
    });
  });

  it("returns the best partial routed preview when no candidate fits within tolerance", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi
          .fn()
          .mockResolvedValueOnce({
            distanceMeters: 12_520,
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
            surfaceDetails: createUnknownSurfaceDetails(12_520),
          })
          .mockResolvedValueOnce({
            distanceMeters: 12_340,
            durationMs: 4_880_000,
            elevationGainMeters: 84,
            geometry: {
              type: "LineString",
              coordinates: [
                [10.1228, 54.3233],
                [10.1478, 54.3341],
                [10.1228, 54.3233],
              ],
            },
            surfaceDetails: createUnknownSurfaceDetails(12_340),
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

    expect(response).toEqual({
      routeId: "warning-seed-counter",
      status: "partial",
      warnings: [
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
      ],
      summary: {
        totalDistanceKm: 12.34,
        targetDistanceKm: 12,
        distanceDeltaMeters: 340,
        elevationGainMeters: 84,
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
          [10.1478, 54.3341],
          [10.1228, 54.3233],
        ],
      },
    });
  });

  it("keeps evaluating later candidates after an earlier routing failure", async () => {
    const getRoute = vi
      .fn()
      .mockRejectedValueOnce(
        new GraphHopperUnavailableError(
          "GraphHopper returned 503 for route requests.",
          503,
        ),
      )
      .mockResolvedValueOnce({
        distanceMeters: 20_040,
        durationMs: 2_340_000,
        elevationGainMeters: 120,
        geometry: {
          type: "LineString",
          coordinates: [
            [10.1228, 54.3233],
            [10.141, 54.332],
            [10.1228, 54.3233],
          ],
        },
        surfaceDetails: createUnknownSurfaceDetails(20_040),
      });
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    const response = await service.generateRoute({
      activity: "cycling",
      passThroughPoints: [],
      randomSeed: "recovery-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "indifferent",
      targetDistanceKm: 20,
      toleranceMeters: 150,
    });

    expect(getRoute).toHaveBeenCalledTimes(2);
    expect(response).toEqual({
      routeId: "recovery-seed-counter",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 20.04,
        targetDistanceKm: 20,
        distanceDeltaMeters: 40,
        elevationGainMeters: 120,
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
          [10.141, 54.332],
          [10.1228, 54.3233],
        ],
      },
    });
  });

  it("returns a failed response when every routed candidate fails", async () => {
    const getRoute = vi
      .fn()
      .mockRejectedValue(
        new GraphHopperUnavailableError(
          "GraphHopper returned 503 for route requests.",
          503,
        ),
      );
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
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
    expect(getRoute).toHaveBeenCalledTimes(2);
  });

  it("maps malformed routing-engine data into a failed response when no candidate can be scored", async () => {
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
