import { describe, expect, it } from "vitest";

import { scoreRoutedCandidate } from "./routed-candidate-scoring.js";

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
        geometry: {
          type: "LineString",
          coordinates: [
            [10.1228, 54.3233],
            [10.1452, 54.3321],
            [10.1228, 54.3233],
          ],
        },
      },
    });

    expect(scoredCandidate).toEqual({
      routeId: "candidate-001",
      score: -40,
      distanceFitScore: -40,
      isWithinTolerance: true,
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
        geometry: {
          type: "LineString",
          coordinates: [
            [10.1228, 54.3233],
            [10.152, 54.3375],
            [10.1228, 54.3233],
          ],
        },
      },
    });

    expect(scoredCandidate.status).toBe("partial");
    expect(scoredCandidate.score).toBe(-340);
    expect(scoredCandidate.distanceFitScore).toBe(-340);
    expect(scoredCandidate.isWithinTolerance).toBe(false);
    expect(scoredCandidate.summary.distanceDeltaMeters).toBe(340);
    expect(scoredCandidate.warnings).toEqual([
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
        geometry: {
          type: "LineString",
          coordinates: [
            [10.1228, 54.3233],
            [10.141, 54.332],
          ],
        },
      },
    });
    const fartherCandidate = scoreRoutedCandidate({
      request,
      candidate: {
        routeId: "candidate-farther",
        distanceMeters: 20_380,
        durationMs: 2_340_000,
        elevationGainMeters: 120,
        geometry: {
          type: "LineString",
          coordinates: [
            [10.1228, 54.3233],
            [10.152, 54.3375],
          ],
        },
      },
    });

    expect(closerCandidate.score).toBeGreaterThan(fartherCandidate.score);
    expect(closerCandidate.distanceFitScore).toBe(-60);
    expect(fartherCandidate.distanceFitScore).toBe(-380);
  });
});
