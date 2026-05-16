import { describe, expect, it, vi } from "vitest";

import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
} from "./graphhopper-adapter.js";
import { createRouteGenerationService as createRouteGenerationServiceWithDefaults } from "./route-generation-service.js";

function createSurfaceDetails(
  details: Array<{
    bikeAccess?: string | null;
    bikeRoadAccess?: string | null;
    distanceMeters: number;
    footAccess?: string | null;
    footRoadAccess?: string | null;
    surface: string | null;
    roadClass: string | null;
  }>,
) {
  return details.map((detail) => ({
    bikeAccess: null,
    bikeRoadAccess: null,
    footAccess: null,
    footRoadAccess: null,
    ...detail,
  }));
}

function createUnknownSurfaceDetails(distanceMeters: number) {
  return [
    {
      bikeAccess: null,
      bikeRoadAccess: null,
      distanceMeters,
      footAccess: null,
      footRoadAccess: null,
      surface: null,
      roadClass: null,
    },
  ];
}

function createLoopGeometry(
  outerCoordinate: [number, number],
  returnCoordinate: [number, number] = [
    Number((outerCoordinate[0] - 0.0104).toFixed(4)),
    Number((outerCoordinate[1] + 0.0102).toFixed(4)),
  ],
) {
  return {
    type: "LineString" as const,
    coordinates: [
      [10.1228, 54.3233] as [number, number],
      outerCoordinate,
      returnCoordinate,
      [10.1228, 54.3233] as [number, number],
    ],
  };
}

function createInstructions(points: Array<[number, number]>) {
  const [startCoordinate] = points;
  const endCoordinate = points[points.length - 1] ??
    startCoordinate ?? [10.1228, 54.3233];

  return [
    {
      distanceFromStartMeters: 0,
      distanceToNextMeters: 750,
      type: "depart",
      text: "Start route",
      streetName: null,
      coordinate: startCoordinate ?? [10.1228, 54.3233],
    },
    {
      distanceFromStartMeters: 750,
      distanceToNextMeters: null,
      type: "arrive",
      text: "Arrive at destination",
      streetName: null,
      coordinate: endCoordinate ?? startCoordinate ?? [10.1228, 54.3233],
    },
  ];
}

function createRouteGenerationService(
  options: Parameters<typeof createRouteGenerationServiceWithDefaults>[0],
) {
  return createRouteGenerationServiceWithDefaults({
    automaticCandidateRetryCount: 20,
    automaticCandidateSearchBudgetMs: 10_000,
    ...options,
  });
}

function createRoundTripMissGeometry() {
  return {
    type: "LineString" as const,
    coordinates: [
      [10.1228, 54.3233] as [number, number],
      [10.1228, 54.3333] as [number, number],
      [10.1228, 54.3433] as [number, number],
      [10.1228, 54.3333] as [number, number],
      [10.1228, 54.3233] as [number, number],
    ],
  };
}

describe("createRouteGenerationService", () => {
  it("fails before routing when the requested start point is outside the supported region", async () => {
    const getRoute = vi.fn();
    const service = createRouteGenerationService({
      automaticCandidateRetryCount: 0,
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: "region-request-seed",
        start: { lat: 52.52, lon: 13.405 },
        surfacePreference: "mixed",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "unsupported-region-request",
      status: "failed",
      warnings: [
        {
          code: "request_points_out_of_supported_region",
          message:
            "The requested start point is outside the supported Schleswig-Holstein region.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
    expect(getRoute).not.toHaveBeenCalled();
  });

  it("fails before routing when a pass-through point is outside the supported region", async () => {
    const getRoute = vi.fn();
    const service = createRouteGenerationService({
      automaticCandidateRetryCount: 0,
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [{ lat: 52.52, lon: 13.405 }],
        randomSeed: "region-pass-through-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "unsupported-region-request",
      status: "failed",
      warnings: [
        {
          code: "request_points_out_of_supported_region",
          message:
            "A requested pass-through point is outside the supported Schleswig-Holstein region.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
    expect(getRoute).not.toHaveBeenCalled();
  });

  it("snaps the start and pass-through points before candidate generation when the routing engine supports nearest-point lookup", async () => {
    const rawStart = { lat: 54.32332, lon: 10.12276 };
    const snappedStart = { lat: 54.3233, lon: 10.1228 };
    const rawPassThroughPoint = { lat: 54.32742, lon: 10.13036 };
    const snappedPassThroughPoint = { lat: 54.3274, lon: 10.1304 };
    const snapCoordinate = vi
      .fn()
      .mockResolvedValueOnce({
        coordinate: snappedStart,
        distanceMeters: 13.1,
      })
      .mockResolvedValueOnce({
        coordinate: snappedPassThroughPoint,
        distanceMeters: 8.7,
      });
    const getRoute = vi.fn().mockResolvedValue({
      distanceMeters: 8_040,
      durationMs: 3_100_000,
      elevationGainMeters: 42,
      geometry: createLoopGeometry([10.1304, 54.3274]),
      instructions: createInstructions(
        createLoopGeometry([10.1304, 54.3274]).coordinates,
      ),
      surfaceDetails: createUnknownSurfaceDetails(8_040),
    });
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
        snapCoordinate,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [rawPassThroughPoint],
        randomSeed: "snap-seed",
        start: rawStart,
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toMatchObject({
      status: expect.stringMatching(/^(success|partial)$/),
    });

    expect(snapCoordinate).toHaveBeenCalledTimes(2);
    expect(snapCoordinate).toHaveBeenNthCalledWith(1, {
      activity: "running_walking",
      coordinate: rawStart,
    });
    expect(snapCoordinate).toHaveBeenNthCalledWith(2, {
      activity: "running_walking",
      coordinate: rawPassThroughPoint,
    });
    expect(getRoute).toHaveBeenCalled();
    expect(
      getRoute.mock.calls.every(([request]) => {
        const points = request.points;

        return (
          points[0]?.lat === snappedStart.lat &&
          points[0]?.lon === snappedStart.lon &&
          points[points.length - 1]?.lat === snappedStart.lat &&
          points[points.length - 1]?.lon === snappedStart.lon &&
          points.some(
            (point: { lat: number; lon: number }) =>
              point.lat === snappedPassThroughPoint.lat &&
              point.lon === snappedPassThroughPoint.lon,
          )
        );
      }),
    ).toBe(true);
  });

  it("returns a successful routed preview when the best routed candidate fits the request", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi
          .fn()
          .mockResolvedValueOnce({
            distanceMeters: 12_240,
            durationMs: 4_920_000,
            elevationGainMeters: 88,
            geometry: createLoopGeometry([10.1452, 54.3321]),
            instructions: createInstructions(
              createLoopGeometry([10.1452, 54.3321]).coordinates,
            ),
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
            geometry: createLoopGeometry([10.141, 54.332]),
            instructions: createInstructions(
              createLoopGeometry([10.141, 54.332]).coordinates,
            ),
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
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 50,
          trailUnpavedPercent: 25,
          fieldTrackOtherPercent: 25,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: createInstructions(
        createLoopGeometry([10.141, 54.332]).coordinates,
      ),
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
            geometry: createLoopGeometry([10.152, 54.3375]),
            instructions: [],
            surfaceDetails: createUnknownSurfaceDetails(12_520),
          })
          .mockResolvedValueOnce({
            distanceMeters: 12_340,
            durationMs: 4_880_000,
            elevationGainMeters: 84,
            geometry: createLoopGeometry([10.1478, 54.3341]),
            instructions: [],
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
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 0,
          trailUnpavedPercent: 0,
          fieldTrackOtherPercent: 0,
          unknownPercent: 100,
        },
      },
      geometry: createLoopGeometry([10.1478, 54.3341]),
      instructions: [],
    });
  });

  it("tries a compact fallback family when the primary routed candidates exceed the supported distance limit", async () => {
    const getRoute = vi
      .fn()
      .mockResolvedValueOnce({
        distanceMeters: 15_080,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createLoopGeometry([10.152, 54.3375]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(15_080),
      })
      .mockResolvedValueOnce({
        distanceMeters: 14_720,
        durationMs: 4_880_000,
        elevationGainMeters: 84,
        geometry: createLoopGeometry([10.1478, 54.3341]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(14_720),
      })
      .mockResolvedValueOnce({
        distanceMeters: 8_180,
        durationMs: 3_420_000,
        elevationGainMeters: 64,
        geometry: createLoopGeometry([10.1361, 54.3295]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(8_180),
      })
      .mockResolvedValueOnce({
        distanceMeters: 8_060,
        durationMs: 3_380_000,
        elevationGainMeters: 61,
        geometry: createLoopGeometry([10.1341, 54.3288]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(8_060),
      });
    const service = createRouteGenerationService({
      automaticCandidateRetryCount: 0,
      routingEngine: {
        getRoute,
      },
    });

    const response = await service.generateRoute({
      activity: "running_walking",
      passThroughPoints: [],
      randomSeed: null,
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "mixed",
      targetDistanceKm: 8,
      toleranceMeters: 150,
    });

    expect(getRoute).toHaveBeenCalledTimes(3);
    expect(response.status).toBe("partial");
    expect(response.summary).toMatchObject({
      totalDistanceKm: 8.18,
      targetDistanceKm: 8,
      distanceDeltaMeters: 180,
      elevationGainMeters: 64,
      loop: {
        startOffsetMeters: 0,
        endOffsetMeters: 0,
        closureGapMeters: 0,
        bidirectionalOverlapMeters: 0,
      },
      surface: {
        asphaltPercent: 0,
        trailUnpavedPercent: 0,
        fieldTrackOtherPercent: 0,
        unknownPercent: 100,
      },
    });
    expect(response.geometry).toEqual(createLoopGeometry([10.1361, 54.3295]));
    expect(response.instructions).toEqual([]);
    expect(response.warnings).toEqual([
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
    ]);
  });

  it("fails explicitly when every scored candidate exceeds the supported distance limit", async () => {
    const getRoute = vi.fn().mockResolvedValue({
      distanceMeters: 15_080,
      durationMs: 4_920_000,
      elevationGainMeters: 88,
      geometry: createLoopGeometry([10.152, 54.3375]),
      instructions: [],
      surfaceDetails: createUnknownSurfaceDetails(15_080),
    });
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "distance-fit-unavailable",
      status: "failed",
      warnings: [
        {
          code: "route_exceeds_supported_distance_limit",
          message:
            "No legal round course could be generated within 400 meters of the requested distance.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
    expect(getRoute.mock.calls.length).toBeGreaterThan(2);
  });

  it("fails explicitly when requested pass-through points make the distance target infeasible", async () => {
    const getRoute = vi.fn().mockResolvedValue({
      distanceMeters: 15_080,
      durationMs: 4_920_000,
      elevationGainMeters: 88,
      geometry: createLoopGeometry([10.152, 54.3375]),
      instructions: [],
      surfaceDetails: createUnknownSurfaceDetails(15_080),
    });
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [{ lat: 54.3418, lon: 10.1644 }],
        randomSeed: "distance-pass-through-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "distance-fit-constraints-unavailable",
      status: "failed",
      warnings: [
        {
          code: "route_cannot_meet_requested_constraints",
          message:
            "No legal round course could include the requested pass-through points and stay within 400 meters of the requested distance.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
    expect(getRoute.mock.calls.length).toBeGreaterThan(2);
  });

  it("fails explicitly when supported routing constraints prevent a distance-fitting legal loop", async () => {
    const getRoute = vi
      .fn()
      .mockResolvedValueOnce({
        distanceMeters: 8_060,
        durationMs: 3_380_000,
        elevationGainMeters: 61,
        geometry: createLoopGeometry([10.1341, 54.3288]),
        instructions: [],
        surfaceDetails: createSurfaceDetails([
          {
            bikeAccess: "no",
            distanceMeters: 8_060,
            surface: "asphalt",
            roadClass: "secondary",
          },
        ]),
      })
      .mockResolvedValue({
        distanceMeters: 15_080,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createLoopGeometry([10.152, 54.3375]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(15_080),
      });
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "cycling",
        passThroughPoints: [],
        randomSeed: "distance-legality-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "distance-fit-constraints-unavailable",
      status: "failed",
      warnings: [
        {
          code: "route_cannot_meet_requested_constraints",
          message:
            "No legal round course could stay within 400 meters of the requested distance once supported routing constraints were applied.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
    expect(getRoute.mock.calls.length).toBeGreaterThan(2);
  });

  it("retries additional default candidate seeds after a round-trip contract miss", async () => {
    const getRoute = vi.fn();
    const repeatedPathRoute = {
      distanceMeters: 8_060,
      durationMs: 3_380_000,
      elevationGainMeters: 61,
      geometry: createRoundTripMissGeometry(),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 8_060,
          surface: "asphalt",
          roadClass: "residential",
        },
      ]),
    };
    const successfulRetryRoute = {
      distanceMeters: 8_020,
      durationMs: 3_320_000,
      elevationGainMeters: 58,
      geometry: createLoopGeometry([10.1336, 54.3284]),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 8_020,
          surface: "asphalt",
          roadClass: "residential",
        },
      ]),
    };

    for (let attempt = 0; attempt < 21; attempt += 1) {
      getRoute.mockResolvedValueOnce(repeatedPathRoute);
    }

    getRoute.mockResolvedValueOnce(successfulRetryRoute);

    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toMatchObject({
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 8.02,
        targetDistanceKm: 8,
        distanceDeltaMeters: 20,
        elevationGainMeters: 58,
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 100,
          trailUnpavedPercent: 0,
          fieldTrackOtherPercent: 0,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.1336, 54.3284]),
      instructions: [],
    });
    expect(getRoute.mock.calls.length).toBeGreaterThan(20);
  });

  it("retries additional default candidate seeds after an initial distance-fit miss", async () => {
    const getRoute = vi.fn();
    const distanceMissRoute = {
      distanceMeters: 9_140,
      durationMs: 3_520_000,
      elevationGainMeters: 44,
      geometry: createLoopGeometry([10.1368, 54.3296]),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 9_140,
          surface: "asphalt",
          roadClass: "residential",
        },
      ]),
    };
    const successfulRetryRoute = {
      distanceMeters: 8_260,
      durationMs: 3_260_000,
      elevationGainMeters: 39,
      geometry: createLoopGeometry([10.1339, 54.3285]),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 8_260,
          surface: "asphalt",
          roadClass: "residential",
        },
      ]),
    };

    for (let attempt = 0; attempt < 9; attempt += 1) {
      getRoute.mockResolvedValueOnce(distanceMissRoute);
    }

    getRoute.mockResolvedValueOnce(successfulRetryRoute);

    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toMatchObject({
      status: "partial",
      warnings: [
        {
          code: "distance_outside_tolerance",
          message:
            "The first routed preview is outside the requested distance tolerance.",
        },
      ],
      summary: {
        totalDistanceKm: 8.26,
        targetDistanceKm: 8,
        distanceDeltaMeters: 260,
        elevationGainMeters: 39,
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 100,
          trailUnpavedPercent: 0,
          fieldTrackOtherPercent: 0,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.1339, 54.3285]),
      instructions: [],
    });
    expect(getRoute.mock.calls.length).toBeGreaterThan(8);
  });

  it("fails explicitly when every scored candidate reuses too much path in both directions", async () => {
    const getRoute = vi.fn().mockResolvedValue({
      distanceMeters: 8_060,
      durationMs: 3_380_000,
      elevationGainMeters: 61,
      geometry: {
        type: "LineString",
        coordinates: [
          [10.1228, 54.3233],
          [10.1228, 54.3333],
          [10.1228, 54.3433],
          [10.1228, 54.3333],
          [10.1228, 54.3233],
        ],
      },
      instructions: [],
      surfaceDetails: createUnknownSurfaceDetails(8_060),
    });
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute,
      },
    });

    await expect(
      service.generateRoute({
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 8,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "round-trip-unavailable",
      status: "failed",
      warnings: [
        {
          code: "route_cannot_form_supported_round_trip",
          message:
            "No legal round course could be generated that returned to the start without turning around on itself and with a meaningful loop beyond any shared connector.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
    expect(getRoute.mock.calls.length).toBeGreaterThan(2);
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
        geometry: createLoopGeometry([10.141, 54.332]),
        instructions: createInstructions(
          createLoopGeometry([10.141, 54.332]).coordinates,
        ),
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

    expect(getRoute).toHaveBeenCalledTimes(3);
    expect(response).toEqual({
      routeId: "recovery-seed-counter",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 20.04,
        targetDistanceKm: 20,
        distanceDeltaMeters: 40,
        elevationGainMeters: 120,
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 50,
          trailUnpavedPercent: 50,
          fieldTrackOtherPercent: 0,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: createInstructions(
        createLoopGeometry([10.141, 54.332]).coordinates,
      ),
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
      instructions: null,
    });
    expect(getRoute).toHaveBeenCalledTimes(3);
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
      instructions: null,
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
            geometry: createLoopGeometry([10.152, 54.3375]),
            instructions: createInstructions(
              createLoopGeometry([10.152, 54.3375]).coordinates,
            ),
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
            geometry: createLoopGeometry([10.141, 54.332]),
            instructions: createInstructions(
              createLoopGeometry([10.141, 54.332]).coordinates,
            ),
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
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 10,
          trailUnpavedPercent: 70,
          fieldTrackOtherPercent: 20,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: createInstructions(
        createLoopGeometry([10.141, 54.332]).coordinates,
      ),
    });
  });

  it("skips routed candidates with known legality violations and returns a later legal preview", async () => {
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
            instructions: createInstructions([
              [10.1228, 54.3233],
              [10.152, 54.3375],
            ]),
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 10_020,
                surface: "asphalt",
                roadClass: "trunk",
              },
            ]),
          })
          .mockResolvedValueOnce({
            distanceMeters: 10_080,
            durationMs: 2_360_000,
            elevationGainMeters: 124,
            geometry: createLoopGeometry([10.141, 54.332]),
            instructions: createInstructions(
              createLoopGeometry([10.141, 54.332]).coordinates,
            ),
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 6_048,
                surface: "gravel",
                roadClass: "track",
              },
              {
                distanceMeters: 4_032,
                surface: "asphalt",
                roadClass: "residential",
              },
            ]),
          }),
      },
    });

    const response = await service.generateRoute({
      activity: "cycling",
      passThroughPoints: [],
      randomSeed: "legal-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "mixed",
      targetDistanceKm: 10,
      toleranceMeters: 150,
    });

    expect(response).toEqual({
      routeId: "legal-seed-counter",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 10.08,
        targetDistanceKm: 10,
        distanceDeltaMeters: 80,
        elevationGainMeters: 124,
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 40,
          trailUnpavedPercent: 60,
          fieldTrackOtherPercent: 0,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: createInstructions(
        createLoopGeometry([10.141, 54.332]).coordinates,
      ),
    });
  });

  it("returns a failed response when every routed candidate is rejected for legality", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi.fn().mockResolvedValue({
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
          instructions: createInstructions([
            [10.1228, 54.3233],
            [10.141, 54.332],
          ]),
          surfaceDetails: createSurfaceDetails([
            {
              bikeAccess: "no",
              distanceMeters: 12_040,
              surface: "asphalt",
              roadClass: "secondary",
            },
          ]),
        }),
      },
    });

    await expect(
      service.generateRoute({
        activity: "cycling",
        passThroughPoints: [],
        randomSeed: "illegal-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "indifferent",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "illegal-seed-clockwise",
      status: "failed",
      warnings: [
        {
          code: "route_contains_prohibited_access",
          message:
            "GraphHopper reported bicycle or access restrictions that make this routed candidate unsuitable for cycling.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
  });

  it("skips routed candidates whose geometry leaves the supported region and returns a later in-region preview", async () => {
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
                [13.405, 52.52],
                [10.1228, 54.3233],
              ],
            },
            instructions: createInstructions([
              [10.1228, 54.3233],
              [13.405, 52.52],
            ]),
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 10_020,
                surface: "asphalt",
                roadClass: "secondary",
              },
            ]),
          })
          .mockResolvedValueOnce({
            distanceMeters: 10_080,
            durationMs: 2_360_000,
            elevationGainMeters: 124,
            geometry: createLoopGeometry([10.141, 54.332]),
            instructions: createInstructions(
              createLoopGeometry([10.141, 54.332]).coordinates,
            ),
            surfaceDetails: createSurfaceDetails([
              {
                distanceMeters: 6_048,
                surface: "gravel",
                roadClass: "track",
              },
              {
                distanceMeters: 4_032,
                surface: "asphalt",
                roadClass: "residential",
              },
            ]),
          }),
      },
    });

    await expect(
      service.generateRoute({
        activity: "cycling",
        passThroughPoints: [],
        randomSeed: "region-route-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 10,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "region-route-seed-counter",
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 10.08,
        targetDistanceKm: 10,
        distanceDeltaMeters: 80,
        elevationGainMeters: 124,
        loop: {
          startOffsetMeters: 0,
          endOffsetMeters: 0,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 0,
        },
        surface: {
          asphaltPercent: 40,
          trailUnpavedPercent: 60,
          fieldTrackOtherPercent: 0,
          unknownPercent: 0,
        },
      },
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: createInstructions(
        createLoopGeometry([10.141, 54.332]).coordinates,
      ),
    });
  });

  it("returns a failed response when every routed candidate leaves the supported region", async () => {
    const service = createRouteGenerationService({
      routingEngine: {
        getRoute: vi.fn().mockResolvedValue({
          distanceMeters: 12_040,
          durationMs: 4_910_000,
          elevationGainMeters: 82,
          geometry: {
            type: "LineString",
            coordinates: [
              [10.1228, 54.3233],
              [13.405, 52.52],
              [10.1228, 54.3233],
            ],
          },
          instructions: createInstructions([
            [10.1228, 54.3233],
            [13.405, 52.52],
          ]),
          surfaceDetails: createSurfaceDetails([
            {
              distanceMeters: 12_040,
              surface: "asphalt",
              roadClass: "secondary",
            },
          ]),
        }),
      },
    });

    await expect(
      service.generateRoute({
        activity: "cycling",
        passThroughPoints: [],
        randomSeed: "region-failure-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "indifferent",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      }),
    ).resolves.toEqual({
      routeId: "region-failure-seed-clockwise",
      status: "failed",
      warnings: [
        {
          code: "route_leaves_supported_region",
          message:
            "GraphHopper returned a routed preview that leaves the supported Schleswig-Holstein region.",
        },
      ],
      summary: null,
      geometry: null,
      instructions: null,
    });
  });
});
