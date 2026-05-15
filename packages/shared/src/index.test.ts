import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISTANCE_TOLERANCE_METERS,
  DEFAULT_PLACE_SEARCH_LIMIT,
  placeSearchRequestSchema,
  placeSearchResponseSchema,
  routeGenerateRequestSchema,
  routeGenerateResponseSchema,
  routeInstructionSchema,
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
  it("parses a route response with summary, warnings, geometry, and instructions", () => {
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
        loop: {
          startOffsetMeters: 12,
          endOffsetMeters: 12,
          closureGapMeters: 0,
          bidirectionalOverlapMeters: 180,
        },
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
      instructions: [
        {
          distanceFromStartMeters: 0,
          distanceToNextMeters: 650,
          type: "depart",
          text: "Head north on the trail.",
          streetName: null,
          coordinate: [10.1228, 54.3233],
        },
        {
          distanceFromStartMeters: 650,
          distanceToNextMeters: null,
          type: "arrive",
          text: "Return to the start point.",
          streetName: "Loop path",
          coordinate: [10.141, 54.332],
        },
      ],
    });

    expect(parsed.status).toBe("partial");
    expect(parsed.summary?.surface.trailUnpavedPercent).toBe(65);
    expect(parsed.geometry?.coordinates).toHaveLength(2);
    expect(parsed.instructions).toHaveLength(2);
    expect(parsed.instructions?.[1]?.distanceToNextMeters).toBeNull();
  });

  it("allows failed responses to keep summary, geometry, and instructions as placeholders", () => {
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
      instructions: null,
    });

    expect(parsed.summary).toBeNull();
    expect(parsed.geometry).toBeNull();
    expect(parsed.instructions).toBeNull();
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
          loop: {
            startOffsetMeters: 0,
            endOffsetMeters: 0,
            closureGapMeters: 0,
            bidirectionalOverlapMeters: 0,
          },
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
        instructions: null,
      }),
    ).toThrow();
  });

  it("rejects malformed instruction payloads", () => {
    expect(() =>
      routeGenerateResponseSchema.parse({
        routeId: "route-003",
        status: "success",
        warnings: [],
        summary: {
          totalDistanceKm: 8.5,
          targetDistanceKm: 8,
          distanceDeltaMeters: 500,
          elevationGainMeters: 45,
          loop: {
            startOffsetMeters: 0,
            endOffsetMeters: 0,
            closureGapMeters: 0,
            bidirectionalOverlapMeters: 510,
          },
          surface: {
            asphaltPercent: 40,
            trailUnpavedPercent: 40,
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
        instructions: [
          {
            distanceFromStartMeters: 200,
            distanceToNextMeters: 150,
            type: "",
            text: "Turn right.",
            streetName: null,
            coordinate: [10.13, 54.325],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("routeInstructionSchema", () => {
  it("parses a minimal navigation instruction", () => {
    const parsed = routeInstructionSchema.parse({
      distanceFromStartMeters: 1250,
      distanceToNextMeters: 300,
      type: "turn_right",
      text: "Turn right onto the next path.",
      streetName: "Forest path",
      coordinate: [10.141, 54.332],
    });

    expect(parsed.distanceFromStartMeters).toBe(1250);
    expect(parsed.streetName).toBe("Forest path");
  });
});

describe("placeSearchRequestSchema", () => {
  it("parses a valid request and fills the default limit", () => {
    const parsed = placeSearchRequestSchema.parse({
      query: "  Bad Bramstedt  ",
    });

    expect(parsed).toEqual({
      query: "Bad Bramstedt",
      limit: DEFAULT_PLACE_SEARCH_LIMIT,
    });
  });

  it("coerces query-string limits into numbers", () => {
    const parsed = placeSearchRequestSchema.parse({
      query: "Kiel",
      limit: "7",
    });

    expect(parsed.limit).toBe(7);
  });

  it("rejects blank or too-short queries", () => {
    expect(() =>
      placeSearchRequestSchema.parse({
        query: " ",
      }),
    ).toThrow();
  });
});

describe("placeSearchResponseSchema", () => {
  it("parses a successful place-search response", () => {
    const parsed = placeSearchResponseSchema.parse({
      status: "success",
      query: "Bad Bramstedt",
      results: [
        {
          id: "relation-62644",
          label: "Bad Bramstedt, Schleswig-Holstein, Deutschland",
          coordinate: {
            lat: 53.9188,
            lon: 9.8872,
          },
        },
      ],
      message: "Found 1 local place match.",
    });

    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0]?.coordinate.lat).toBe(53.9188);
  });

  it("allows unavailable responses with empty results", () => {
    const parsed = placeSearchResponseSchema.parse({
      status: "unavailable",
      query: "Kiel",
      results: [],
      message:
        "Local place search is unavailable because PLACE_SEARCH_PROVIDER_URL is not configured.",
    });

    expect(parsed.status).toBe("unavailable");
    expect(parsed.results).toEqual([]);
  });
});
