import { describe, expect, it } from "vitest";

import { createRouteCandidateWaypointSeeds } from "./candidate-waypoint-seeds.js";

describe("createRouteCandidateWaypointSeeds", () => {
  it("returns deterministic candidates for the same request and random seed", () => {
    const request = {
      activity: "running_walking" as const,
      passThroughPoints: [
        { lat: 54.3321, lon: 10.1452 },
        { lat: 54.3418, lon: 10.1644 },
      ],
      randomSeed: "draft-variation-7",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "trail" as const,
      targetDistanceKm: 12,
      toleranceMeters: 150,
    };

    expect(createRouteCandidateWaypointSeeds(request)).toEqual(
      createRouteCandidateWaypointSeeds(request),
    );
  });

  it("preserves pass-through point ordering inside every candidate", () => {
    const firstPassThroughPoint = { lat: 54.3321, lon: 10.1452 };
    const secondPassThroughPoint = { lat: 54.3418, lon: 10.1644 };
    const candidates = createRouteCandidateWaypointSeeds({
      activity: "cycling",
      passThroughPoints: [firstPassThroughPoint, secondPassThroughPoint],
      randomSeed: "clockwise-pass-through",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "mixed",
      targetDistanceKm: 18,
      toleranceMeters: 150,
    });

    for (const candidate of candidates) {
      const firstIndex = findCoordinateIndex(
        candidate.points,
        firstPassThroughPoint,
      );
      const secondIndex = findCoordinateIndex(
        candidate.points,
        secondPassThroughPoint,
      );

      expect(firstIndex).toBeGreaterThan(0);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(candidate.points[0]).toEqual({ lat: 54.3233, lon: 10.1228 });
      expect(candidate.points.at(-1)).toEqual({ lat: 54.3233, lon: 10.1228 });
    }
  });

  it("falls back to a deterministic derived seed when randomSeed is null", () => {
    const request = {
      activity: "running_walking" as const,
      passThroughPoints: [],
      randomSeed: null,
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "indifferent" as const,
      targetDistanceKm: 9,
      toleranceMeters: 150,
    };

    const candidates = createRouteCandidateWaypointSeeds(request);

    expect(candidates).toHaveLength(3);
    expect(candidates[0]?.randomSeed).toBe(candidates[1]?.randomSeed);
    expect(candidates[1]?.randomSeed).toBe(candidates[2]?.randomSeed);
    expect(candidates).toEqual(createRouteCandidateWaypointSeeds(request));
  });
});

function findCoordinateIndex(
  coordinates: Array<{ lat: number; lon: number }>,
  target: { lat: number; lon: number },
) {
  return coordinates.findIndex(
    (coordinate) =>
      coordinate.lat === target.lat && coordinate.lon === target.lon,
  );
}
