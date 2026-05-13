import { describe, expect, it, vi } from "vitest";

import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
  createGraphHopperAdapter,
} from "./graphhopper-adapter.js";

describe("createGraphHopperAdapter", () => {
  it("maps a successful GraphHopper response into normalized route data", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          paths: [
            {
              distance: 12_450,
              time: 2_340_000,
              ascend: 120,
              points: {
                type: "LineString",
                coordinates: [
                  [10.1228, 54.3233],
                  [10.141, 54.332],
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: fetchMock,
    });

    const result = await adapter.getRoute({
      points: [
        { lat: 54.3233, lon: 10.1228 },
        { lat: 54.332, lon: 10.141 },
      ],
      activity: "cycling",
    });

    expect(result).toEqual({
      distanceMeters: 12_450,
      durationMs: 2_340_000,
      elevationGainMeters: 120,
      geometry: {
        type: "LineString",
        coordinates: [
          [10.1228, 54.3233],
          [10.141, 54.332],
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(requestUrl as string);

    expect(url.origin).toBe("http://graphhopper:8989");
    expect(url.pathname).toBe("/api/1/route");
    expect(url.searchParams.getAll("point")).toEqual([
      "54.3233,10.1228",
      "54.332,10.141",
    ]);
    expect(url.searchParams.get("profile")).toBe("bike");
    expect(url.searchParams.get("points_encoded")).toBe("false");
    expect(url.searchParams.get("instructions")).toBe("false");
    expect(url.searchParams.get("elevation")).toBe("true");
  });

  it("throws a dedicated unavailable error when GraphHopper returns a non-ok response", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response("service unavailable", {
          status: 503,
        }),
      ),
    });

    await expect(
      adapter.getRoute({
        points: [
          { lat: 54.3233, lon: 10.1228 },
          { lat: 54.332, lon: 10.141 },
        ],
        activity: "running_walking",
      }),
    ).rejects.toMatchObject({
      code: "routing_engine_unavailable",
      statusCode: 503,
    } satisfies Partial<GraphHopperUnavailableError>);
  });

  it("throws when GraphHopper responds with malformed route data", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 12_450,
                points: {
                  type: "Point",
                  coordinates: [10.1228, 54.3233],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      ),
    });

    await expect(
      adapter.getRoute({
        points: [
          { lat: 54.3233, lon: 10.1228 },
          { lat: 54.332, lon: 10.141 },
        ],
        activity: "running_walking",
      }),
    ).rejects.toBeInstanceOf(GraphHopperInvalidResponseError);
  });
});
