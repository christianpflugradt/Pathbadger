import { describe, expect, it, vi } from "vitest";

import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
} from "./graphhopper-adapter.js";
import { createRouteGenerationService } from "./route-generation-service.js";

function createSurfaceDetails(
  details: Array<{
    distanceMeters: number;
    surface: string | null;
    roadClass: string | null;
  }>,
) {
  return details;
}

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
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 6_120,
                surface: "asphalt",
                roadClass: "residential",
              },
              {
                distanceMeters: 6_120,
                surface: "gravel",
                roadClass: "track",
              },
            ]),
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
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 6_020,
                surface: "asphalt",
                roadClass: "residential",
              },
              {
                distanceMeters: 3_010,
                surface: "gravel",
                roadClass: "track",
              },
              {
                distanceMeters: 3_010,
                surface: null,
                roadClass: "path",
              },
            ]),
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
          asphaltPercent: 50,
          trailUnpavedPercent: 25,
          fieldTrackOtherPercent: 25,
          unknownPercent: 0,
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
          code: "surface_data_incomplete",
          message:
            "Surface classification is incomplete for 100% of this routed preview.",
        },
      ],
      summary: {
        totalDistanceKm: 12.34,
        targetDistanceKm: 12,
        distanceDeltaMeters: 340,
        elevationGainMeters: 84,
        surface: {
          asphaltPercent: 0,
          trailUnpavedPercent: 0,
          fieldTrackOtherPercent: 0,
          unknownPercent: 100,
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
        surfaceDetails: createSurfaceDetails([
          {
            distanceMeters: 10_020,
            surface: "asphalt",
            roadClass: "secondary",
          },
          {
            distanceMeters: 10_020,
            surface: "gravel",
            roadClass: "track",
          },
        ]),
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
          asphaltPercent: 50,
          trailUnpavedPercent: 50,
          fieldTrackOtherPercent: 0,
          unknownPercent: 0,
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

  it("prefers the better trail-matching routed candidate when distance fit is still reasonable", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi
          .fn()
          .mockResolvedValueOnce({
            distanceMeters: 10_020,
            durationMs: 2_340_000,
            elevationGainMeters: 120,
            geometry: {
              type: "LineString",
              coordinates: [
                [10.1228, 54.3233],
                [10.152, 54.3375],
                [10.1228, 54.3233],
              ],
            },
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 9_018,
                surface: "asphalt",
                roadClass: "secondary",
              },
              {
                distanceMeters: 1_002,
                surface: null,
                roadClass: "path",
              },
            ]),
          })
          .mockResolvedValueOnce({
            distanceMeters: 10_100,
            durationMs: 2_360_000,
            elevationGainMeters: 124,
            geometry: {
              type: "LineString",
              coordinates: [
                [10.1228, 54.3233],
                [10.141, 54.332],
                [10.1228, 54.3233],
              ],
            },
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 7_070,
                surface: "gravel",
                roadClass: "track",
              },
              {
                distanceMeters: 2_020,
                surface: null,
                roadClass: "path",
              },
              {
                distanceMeters: 1_010,
                surface: "asphalt",
                roadClass: "residential",
              },
            ]),
          }),
      },
    });

    const response = await service.generateRoute({
      activity: "running_walking",
      passThroughPoints: [],
      randomSeed: "trail-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "trail",
      targetDistanceKm: 10,
      toleranceMeters: 150,
    });

    expect(response).toEqual({
      routeId: "trail-seed-counter",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 10.1,
        targetDistanceKm: 10,
        distanceDeltaMeters: 100,
        elevationGainMeters: 124,
        surface: {
          asphaltPercent: 10,
          trailUnpavedPercent: 70,
          fieldTrackOtherPercent: 20,
          unknownPercent: 0,
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
});
