import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";

describe("createApp", () => {
  it("returns a generated route preview from the route service boundary", async () => {
    const generateRoute = vi.fn().mockResolvedValue({
      routeId: "preview-seed-clockwise",
      status: "partial",
      warnings: [
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
          [10.152, 54.3375],
          [10.1228, 54.3233],
        ],
      },
    });
    const app = createApp({
      routeGenerationService: {
        generateRoute,
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/routes/generate",
      payload: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: "preview-seed",
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "trail",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(generateRoute).toHaveBeenCalledWith({
      activity: "running_walking",
      passThroughPoints: [],
      randomSeed: "preview-seed",
      start: { lat: 54.3233, lon: 10.1228 },
      surfacePreference: "trail",
      targetDistanceKm: 12,
      toleranceMeters: 150,
    });
    expect(response.json()).toEqual({
      routeId: "preview-seed-clockwise",
      status: "partial",
      warnings: [
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
          [10.152, 54.3375],
          [10.1228, 54.3233],
        ],
      },
    });

    await app.close();
  });

  it("rejects malformed route generation requests with a 400", async () => {
    const app = createApp({
      routeGenerationService: {
        generateRoute: vi.fn(),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/routes/generate",
      payload: {
        activity: "swimming",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "trail",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "invalid_route_generate_request",
      message: "Request body does not match the shared route contract.",
    });

    await app.close();
  });
});
