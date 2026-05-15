import { describe, expect, it, vi } from "vitest";

import { requestRoutePreview } from "./route-preview-client.js";

describe("requestRoutePreview", () => {
  it("posts the planning request and returns the parsed route preview", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          routeId: "preview-seed-clockwise",
          status: "partial",
          warnings: [
            {
              code: "surface_data_incomplete",
              message:
                "Surface classification is incomplete for 35% of this routed preview.",
            },
          ],
          summary: {
            totalDistanceKm: 12.34,
            targetDistanceKm: 12,
            distanceDeltaMeters: 340,
            elevationGainMeters: 88,
            loop: {
              startOffsetMeters: 0,
              endOffsetMeters: 0,
              closureGapMeters: 0,
              bidirectionalOverlapMeters: 260,
            },
            surface: {
              asphaltPercent: 25,
              trailUnpavedPercent: 40,
              fieldTrackOtherPercent: 0,
              unknownPercent: 35,
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
          instructions: null,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const response = await requestRoutePreview({
      apiBaseUrl: "/api",
      fetchImpl: fetchMock,
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "trail",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
    });

    expect(response.routeId).toBe("preview-seed-clockwise");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toBe("/api/routes/generate");
    expect(requestInit).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    });
  });

  it("surfaces API error messages for non-ok responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_route_generate_request",
          message: "Request body does not match the shared route contract.",
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await expect(
      requestRoutePreview({
        apiBaseUrl: "/api/",
        fetchImpl: fetchMock,
        request: {
          activity: "running_walking",
          passThroughPoints: [],
          randomSeed: null,
          start: { lat: 54.3233, lon: 10.1228 },
          surfacePreference: "trail",
          targetDistanceKm: 12,
          toleranceMeters: 150,
        },
      }),
    ).rejects.toThrow("Request body does not match the shared route contract.");
  });

  it("rejects malformed successful payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          routeId: "preview-seed-clockwise",
          status: "partial",
          warnings: [],
          summary: {
            totalDistanceKm: 12.34,
          },
          geometry: null,
          instructions: null,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await expect(
      requestRoutePreview({
        apiBaseUrl: "/api",
        fetchImpl: fetchMock,
        request: {
          activity: "running_walking",
          passThroughPoints: [],
          randomSeed: null,
          start: { lat: 54.3233, lon: 10.1228 },
          surfacePreference: "trail",
          targetDistanceKm: 12,
          toleranceMeters: 150,
        },
      }),
    ).rejects.toThrow("API returned an unexpected route preview payload.");
  });

  it("falls back to the same-origin root route when the api base is blank", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          routeId: "preview-seed-clockwise",
          status: "failed",
          warnings: [],
          summary: null,
          geometry: null,
          instructions: null,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await requestRoutePreview({
      apiBaseUrl: "   ",
      fetchImpl: fetchMock,
      request: {
        activity: "running_walking",
        passThroughPoints: [],
        randomSeed: null,
        start: { lat: 54.3233, lon: 10.1228 },
        surfacePreference: "trail",
        targetDistanceKm: 12,
        toleranceMeters: 150,
      },
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toBe("/routes/generate");
  });
});
