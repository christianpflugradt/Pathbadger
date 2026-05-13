import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISTANCE_TOLERANCE_METERS,
  routeGenerateRequestSchema,
  routeGenerateResponseSchema,
} from "./index.js";

describe("routeGenerateRequestSchema", () => {
  it("parses a valid request and fills defaults", () => {
    const parsed = routeGenerateRequestSchema.parse({
      start: { lat: 54.3233, lon: 10.1228 },
      targetDistanceKm: 12.5,
      activity: "running_walking",
      surfacePreference: "trail",
    });

    expect(parsed.passThroughPoints).toEqual([]);
    expect(parsed.randomSeed).toBeNull();
    expect(parsed.toleranceMeters).toBe(DEFAULT_DISTANCE_TOLERANCE_METERS);
  });

  it("preserves optional pass-through points and request seed", () => {
    const parsed = routeGenerateRequestSchema.parse({
      start: { lat: 54.3233, lon: 10.1228 },
      targetDistanceKm: 50,
      activity: "cycling",
      surfacePreference: "mixed",
      passThroughPoints: [
        { lat: 54.332, lon: 10.141 },
        { lat: 54.35, lon: 10.205 },
      ],
      randomSeed: "seed-123",
      toleranceMeters: 225,
    });

    expect(parsed.passThroughPoints).toHaveLength(2);
    expect(parsed.randomSeed).toBe("seed-123");
    expect(parsed.toleranceMeters).toBe(225);
  });

  it("rejects invalid coordinates and target distances", () => {
    expect(() =>
      routeGenerateRequestSchema.parse({
        start: { lat: 95, lon: 10.1228 },
        targetDistanceKm: -1,
        activity: "running_walking",
        surfacePreference: "trail",
      }),
    ).toThrow();
  });
});

describe("routeGenerateResponseSchema", () => {
  it("parses a route response with summary, warnings, and geometry", () => {
    const parsed = routeGenerateResponseSchema.parse({
      routeId: "route-001",
      status: "partial",
      warnings: [
        {
          code: "distance_outside_tolerance",
          message: "Closest legal route is longer than requested.",
        },
      ],
      summary: {
        totalDistanceKm: 12.8,
        targetDistanceKm: 12.5,
        distanceDeltaMeters: 300,
        elevationGainMeters: null,
        surface: {
          asphaltPercent: 15,
          trailUnpavedPercent: 65,
          fieldTrackOtherPercent: 10,
          unknownPercent: 10,
        },
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.1228, 54.3233],
          [10.141, 54.332],
        ],
      },
    });

    expect(parsed.status).toBe("partial");
    expect(parsed.summary?.surface.trailUnpavedPercent).toBe(65);
    expect(parsed.geometry?.coordinates).toHaveLength(2);
  });

  it("allows failed responses to keep summary and geometry as placeholders", () => {
    const parsed = routeGenerateResponseSchema.parse({
      routeId: "route-002",
      status: "failed",
      warnings: [
        {
          code: "routing_engine_unavailable",
          message: "GraphHopper did not respond.",
        },
      ],
      summary: null,
      geometry: null,
    });

    expect(parsed.summary).toBeNull();
    expect(parsed.geometry).toBeNull();
  });

  it("rejects malformed response payloads", () => {
    expect(() =>
      routeGenerateResponseSchema.parse({
        routeId: "",
        status: "success",
        warnings: [],
        summary: {
          totalDistanceKm: 12.5,
          targetDistanceKm: 12.5,
          distanceDeltaMeters: 0,
          elevationGainMeters: null,
          surface: {
            asphaltPercent: 40,
            trailUnpavedPercent: 40,
            fieldTrackOtherPercent: 10,
            unknownPercent: 20,
          },
        },
        geometry: {
          type: "LineString",
          coordinates: [[200, 54.3233]],
        },
      }),
    ).toThrow();
  });
});
