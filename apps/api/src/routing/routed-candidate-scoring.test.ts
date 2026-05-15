import { describe, expect, it } from "vitest";

import {
  findKnownLegalityWarning,
  scoreRoutedCandidate,
} from "./routed-candidate-scoring.js";

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

function createGeometry(coordinates: Array<[number, number]>) {
  return {
    type: "LineString" as const,
    coordinates,
  };
}

function createLoopGeometry(
  outerCoordinate: [number, number],
  returnCoordinate: [number, number] = [
    Number((outerCoordinate[0] - 0.0104).toFixed(4)),
    Number((outerCoordinate[1] + 0.0102).toFixed(4)),
  ],
) {
  return createGeometry([
    [10.1228, 54.3233],
    outerCoordinate,
    returnCoordinate,
    [10.1228, 54.3233],
  ]);
}

function createInstructions(points: Array<[number, number]> = []) {
  const startCoordinate = points[0] ?? ([10.1228, 54.3233] as [number, number]);
  const endCoordinate = points[points.length - 1] ?? startCoordinate;

  return [
    {
      distanceFromStartMeters: 0,
      distanceToNextMeters: 500,
      type: "depart",
      text: "Start route",
      streetName: null,
      coordinate: startCoordinate,
    },
    {
      distanceFromStartMeters: 500,
      distanceToNextMeters: null,
      type: "arrive",
      text: "Arrive at destination",
      streetName: null,
      coordinate: endCoordinate,
    },
  ];
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

describe("scoreRoutedCandidate", () => {
  it("scores a within-tolerance indifferent candidate as a successful preview", () => {
    const scoredCandidate = scoreRoutedCandidate({
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "indifferent",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
      candidate: {
        routeId: "candidate-001",
        distanceMeters: 12_040,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createLoopGeometry([10.1452, 54.3321]),
        instructions: createInstructions([
          [10.1228, 54.3233],
          [10.1228, 54.3233],
        ]),
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
      },
    });

    expect(scoredCandidate).toEqual({
      routeId: "candidate-001",
      score: -40,
      distanceFitScore: -40,
      surfacePreferenceScore: 0,
      isWithinTolerance: true,
      isWithinSupportedDistanceLimit: true,
      isWithinSupportedRoundTripContract: true,
      status: "success",
      warnings: [],
      summary: {
        totalDistanceKm: 12.04,
        targetDistanceKm: 12,
        distanceDeltaMeters: 40,
        elevationGainMeters: 88,
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
      geometry: createLoopGeometry([10.1452, 54.3321]),
      instructions: createInstructions([
        [10.1228, 54.3233],
        [10.1228, 54.3233],
      ]),
    });
  });

  it("flags motorway or trunk evidence as a hard legality rejection", () => {
    expect(
      findKnownLegalityWarning({
        request: {
          activity: "cycling",
          passThroughPoints: [],
          randomSeed: null,
          start: { lat: 54.3233, lon: 10.1228 },
          surfacePreference: "indifferent",
          targetDistanceKm: 20,
          toleranceMeters: 150,
        },
        candidate: {
          routeId: "candidate-illegal-road-class",
          distanceMeters: 20_040,
          durationMs: 2_340_000,
          elevationGainMeters: 120,
          geometry: createLoopGeometry([10.141, 54.332]),
          instructions: [],
          surfaceDetails: createSurfaceDetails([
            {
              distanceMeters: 20_040,
              surface: "asphalt",
              roadClass: "trunk",
            },
          ]),
        },
      }),
    ).toEqual({
      code: "route_contains_prohibited_road_class",
      message:
        "GraphHopper reported motorway or trunk segments that are unsuitable for the requested activity.",
    });
  });

  it("flags explicit mode-specific access restrictions as a hard legality rejection", () => {
    expect(
      findKnownLegalityWarning({
        request: {
          activity: "running_walking",
          passThroughPoints: [],
          randomSeed: null,
          start: { lat: 54.3233, lon: 10.1228 },
          surfacePreference: "trail",
          targetDistanceKm: 10,
          toleranceMeters: 150,
        },
        candidate: {
          routeId: "candidate-illegal-access",
          distanceMeters: 10_020,
          durationMs: 2_340_000,
          elevationGainMeters: 120,
          geometry: createLoopGeometry([10.141, 54.332]),
          instructions: [],
          surfaceDetails: createSurfaceDetails([
            {
              distanceMeters: 10_020,
              footAccess: "no",
              surface: "gravel",
              roadClass: "path",
            },
          ]),
        },
      }),
    ).toEqual({
      code: "route_contains_prohibited_access",
      message:
        "GraphHopper reported foot or access restrictions that make this routed candidate unsuitable for running or walking.",
    });
  });

  it("exposes distance-fit and partial-fit reasons when the preview is incomplete", () => {
    const scoredCandidate = scoreRoutedCandidate({
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "trail",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
      candidate: {
        routeId: "candidate-002",
        distanceMeters: 12_340,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createLoopGeometry([10.152, 54.3375]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(12_340),
      },
    });

    expect(scoredCandidate.status).toBe("partial");
    expect(scoredCandidate.distanceFitScore).toBe(-340);
    expect(scoredCandidate.surfacePreferenceScore).toBe(-100);
    expect(scoredCandidate.score).toBe(-440);
    expect(scoredCandidate.isWithinTolerance).toBe(false);
    expect(scoredCandidate.isWithinSupportedDistanceLimit).toBe(true);
    expect(scoredCandidate.isWithinSupportedRoundTripContract).toBe(true);
    expect(scoredCandidate.summary.distanceDeltaMeters).toBe(340);
    expect(scoredCandidate.summary.loop.bidirectionalOverlapMeters).toBe(0);
    expect(scoredCandidate.summary.surface).toEqual({
      asphaltPercent: 0,
      trailUnpavedPercent: 0,
      fieldTrackOtherPercent: 0,
      unknownPercent: 100,
    });
    expect(scoredCandidate.warnings).toEqual([
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

  it("marks candidates beyond the supported 400 meter distance limit", () => {
    const scoredCandidate = scoreRoutedCandidate({
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
      candidate: {
        routeId: "candidate-too-far",
        distanceMeters: 12_520,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createLoopGeometry([10.152, 54.3375]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(12_520),
      },
    });

    expect(scoredCandidate.isWithinTolerance).toBe(false);
    expect(scoredCandidate.isWithinSupportedDistanceLimit).toBe(false);
    expect(scoredCandidate.isWithinSupportedRoundTripContract).toBe(true);
    expect(scoredCandidate.summary.distanceDeltaMeters).toBe(520);
  });

  it("marks routed previews with long bidirectional retracing as unsupported round trips", () => {
    const scoredCandidate = scoreRoutedCandidate({
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
      candidate: {
        routeId: "candidate-overlap",
        distanceMeters: 12_080,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createGeometry([
          [10.1228, 54.3233],
          [10.1228, 54.3383],
          [10.1228, 54.3533],
          [10.1228, 54.3383],
          [10.1228, 54.3233],
        ]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(12_080),
      },
    });

    expect(scoredCandidate.isWithinSupportedDistanceLimit).toBe(true);
    expect(scoredCandidate.isWithinSupportedRoundTripContract).toBe(false);
    expect(
      scoredCandidate.summary.loop.bidirectionalOverlapMeters,
    ).toBeGreaterThan(500);
    expect(scoredCandidate.warnings).toContainEqual({
      code: "route_reuses_too_much_path",
      message:
        "The routed preview reuses more than 500 meters of the same path in opposite directions.",
    });
  });

  it("marks routed previews that do not return to the requested start area", () => {
    const scoredCandidate = scoreRoutedCandidate({
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "mixed",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
      candidate: {
        routeId: "candidate-not-closed",
        distanceMeters: 12_060,
        durationMs: 4_920_000,
        elevationGainMeters: 88,
        geometry: createGeometry([
          [10.1248, 54.3253],
          [10.1452, 54.3321],
          [10.1378, 54.3432],
          [10.1248, 54.3253],
        ]),
        instructions: [],
        surfaceDetails: createUnknownSurfaceDetails(12_060),
      },
    });

    expect(scoredCandidate.isWithinSupportedDistanceLimit).toBe(true);
    expect(scoredCandidate.isWithinSupportedRoundTripContract).toBe(false);
    expect(scoredCandidate.summary.loop.startOffsetMeters).toBeGreaterThan(150);
    expect(scoredCandidate.warnings).toContainEqual({
      code: "route_does_not_return_to_start",
      message:
        "The routed preview does not return closely enough to the requested start area.",
    });
  });

  it("gives higher scores to routed candidates with tighter distance fit", () => {
    const request = {
      activity: "cycling" as const,
      passThroughPoints: [],
      randomSeed: null,
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "indifferent" as const,
      targetDistanceKm: 20,
      toleranceMeters: 150,
    };
    const closerCandidate = scoreRoutedCandidate({
      request,
      candidate: {
        routeId: "candidate-closer",
        distanceMeters: 20_060,
        durationMs: 2_340_000,
        elevationGainMeters: 120,
        geometry: createLoopGeometry([10.141, 54.332]),
        instructions: [],
        surfaceDetails: createSurfaceDetails([
          {
            distanceMeters: 10_030,
            surface: "asphalt",
            roadClass: "residential",
          },
          {
            distanceMeters: 10_030,
            surface: "gravel",
            roadClass: "track",
          },
        ]),
      },
    });
    const fartherCandidate = scoreRoutedCandidate({
      request,
      candidate: {
        routeId: "candidate-farther",
        distanceMeters: 20_380,
        durationMs: 2_340_000,
        elevationGainMeters: 120,
        geometry: createLoopGeometry([10.152, 54.3375]),
        instructions: [],
        surfaceDetails: createSurfaceDetails([
          {
            distanceMeters: 10_190,
            surface: "asphalt",
            roadClass: "residential",
          },
          {
            distanceMeters: 10_190,
            surface: "gravel",
            roadClass: "track",
          },
        ]),
      },
    });

    expect(closerCandidate.score).toBeGreaterThan(fartherCandidate.score);
    expect(closerCandidate.distanceFitScore).toBe(-60);
    expect(fartherCandidate.distanceFitScore).toBe(-380);
  });

  it("makes trail and asphalt preferences observable in candidate scores", () => {
    const trailCandidate = {
      routeId: "candidate-trail",
      distanceMeters: 10_040,
      durationMs: 2_340_000,
      elevationGainMeters: 120,
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 7_028,
          surface: "gravel",
          roadClass: "track",
        },
        {
          distanceMeters: 2_008,
          surface: null,
          roadClass: "path",
        },
        {
          distanceMeters: 1_004,
          surface: "asphalt",
          roadClass: "residential",
        },
      ]),
    };
    const asphaltCandidate = {
      routeId: "candidate-asphalt",
      distanceMeters: 10_040,
      durationMs: 2_340_000,
      elevationGainMeters: 120,
      geometry: createLoopGeometry([10.152, 54.3375]),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 8_032,
          surface: "asphalt",
          roadClass: "secondary",
        },
        {
          distanceMeters: 2_008,
          surface: "gravel",
          roadClass: "track",
        },
      ]),
    };

    const trailRequest = {
      activity: "running_walking" as const,
      passThroughPoints: [],
      randomSeed: null,
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "trail" as const,
      targetDistanceKm: 10,
      toleranceMeters: 150,
    };
    const asphaltRequest = {
      ...trailRequest,
      surfacePreference: "asphalt" as const,
    };

    expect(
      scoreRoutedCandidate({
        request: trailRequest,
        candidate: trailCandidate,
      }).score,
    ).toBeGreaterThan(
      scoreRoutedCandidate({
        request: trailRequest,
        candidate: asphaltCandidate,
      }).score,
    );
    expect(
      scoreRoutedCandidate({
        request: asphaltRequest,
        candidate: asphaltCandidate,
      }).score,
    ).toBeGreaterThan(
      scoreRoutedCandidate({
        request: asphaltRequest,
        candidate: trailCandidate,
      }).score,
    );
  });

  it("keeps mixed preference from collapsing into always-closest distance fit", () => {
    const balancedCandidate = {
      routeId: "candidate-balanced",
      distanceMeters: 10_120,
      durationMs: 2_340_000,
      elevationGainMeters: 120,
      geometry: createLoopGeometry([10.141, 54.332]),
      instructions: [],
      surfaceDetails: createSurfaceDetails([
        {
          distanceMeters: 4_048,
          surface: "asphalt",
          roadClass: "residential",
        },
        {
          distanceMeters: 3_036,
          surface: "gravel",
          roadClass: "track",
        },
        {
          distanceMeters: 3_036,
          surface: null,
          roadClass: "path",
        },
      ]),
    };
    const oneSidedCandidate = {
      routeId: "candidate-one-sided",
      distanceMeters: 10_020,
      durationMs: 2_340_000,
      elevationGainMeters: 120,
      geometry: createLoopGeometry([10.152, 54.3375]),
      instructions: [],
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
    };
    const mixedRequest = {
      activity: "cycling" as const,
      passThroughPoints: [],
      randomSeed: null,
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "mixed" as const,
      targetDistanceKm: 10,
      toleranceMeters: 150,
    };
    const indifferentRequest = {
      ...mixedRequest,
      surfacePreference: "indifferent" as const,
    };

    expect(
      scoreRoutedCandidate({
        request: mixedRequest,
        candidate: balancedCandidate,
      }).score,
    ).toBeGreaterThan(
      scoreRoutedCandidate({
        request: mixedRequest,
        candidate: oneSidedCandidate,
      }).score,
    );
    expect(
      scoreRoutedCandidate({
        request: indifferentRequest,
        candidate: oneSidedCandidate,
      }).score,
    ).toBeGreaterThan(
      scoreRoutedCandidate({
        request: indifferentRequest,
        candidate: balancedCandidate,
      }).score,
    );
  });
});
