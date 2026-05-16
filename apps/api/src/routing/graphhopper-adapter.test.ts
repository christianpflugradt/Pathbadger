import { describe, expect, it, vi } from "vitest";

import {
  GraphHopperInvalidResponseError,
  GraphHopperUnavailableError,
  createGraphHopperAdapter,
} from "./graphhopper-adapter.js";

describe("createGraphHopperAdapter", () => {
  it("maps a successful GraphHopper nearest-point response into a snapped coordinate", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          coordinates: [10.12281, 54.32331],
          distance: 12.75,
          type: "Point",
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

    const result = await adapter.snapCoordinate!({
      activity: "running_walking",
      coordinate: { lat: 54.3233, lon: 10.1228 },
    });

    expect(result).toEqual({
      coordinate: { lat: 54.32331, lon: 10.12281 },
      distanceMeters: 12.75,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(requestUrl as string);

    expect(url.origin).toBe("http://graphhopper:8989");
    expect(url.pathname).toBe("/nearest");
    expect(url.searchParams.get("point")).toBe("54.3233,10.1228");
    expect(url.searchParams.get("profile")).toBe("foot");
  });

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
                  [10.1304, 54.3274],
                  [10.141, 54.332],
                ],
              },
              instructions: [
                {
                  distance: 6_200,
                  sign: 0,
                  interval: [0, 1],
                  text: "Continue onto the cycle path",
                  street_name: "",
                },
                {
                  distance: 6_250,
                  sign: 4,
                  interval: [2, 2],
                  text: "Arrive at destination",
                  street_name: "",
                },
              ],
              details: {
                bike_access: [
                  [0, 1, true],
                  [1, 2, false],
                ],
                bike_road_access: [
                  [0, 1, "designated"],
                  [1, 2, "destination"],
                ],
                foot_access: [
                  [0, 1, true],
                  [1, 2, false],
                ],
                foot_road_access: [
                  [0, 1, "designated"],
                  [1, 2, "destination"],
                ],
                surface: [
                  [0, 1, "asphalt"],
                  [1, 2, "gravel"],
                ],
                road_class: [
                  [0, 1, "secondary"],
                  [1, 2, "track"],
                ],
                distance: [
                  [0, 1, 6_200],
                  [1, 2, 6_250],
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
          [10.1304, 54.3274],
          [10.141, 54.332],
        ],
      },
      instructions: [
        {
          distanceFromStartMeters: 0,
          distanceToNextMeters: 6_200,
          type: "depart",
          text: "Continue onto the cycle path",
          streetName: null,
          coordinate: [10.1228, 54.3233],
        },
        {
          distanceFromStartMeters: 6_200,
          distanceToNextMeters: null,
          type: "arrive",
          text: "Arrive at destination",
          streetName: null,
          coordinate: [10.141, 54.332],
        },
      ],
      surfaceDetails: [
        {
          bikeAccess: "yes",
          bikeRoadAccess: "designated",
          distanceMeters: 6_200,
          footAccess: "yes",
          footRoadAccess: "designated",
          surface: "asphalt",
          roadClass: "secondary",
        },
        {
          bikeAccess: "no",
          bikeRoadAccess: "destination",
          distanceMeters: 6_250,
          footAccess: "no",
          footRoadAccess: "destination",
          surface: "gravel",
          roadClass: "track",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(requestUrl as string);

    expect(url.origin).toBe("http://graphhopper:8989");
    expect(url.pathname).toBe("/route");
    expect(url.searchParams.getAll("point")).toEqual([
      "54.3233,10.1228",
      "54.332,10.141",
    ]);
    expect(url.searchParams.get("profile")).toBe("bike");
    expect(url.searchParams.get("points_encoded")).toBe("false");
    expect(url.searchParams.get("instructions")).toBe("true");
    expect(url.searchParams.getAll("details")).toEqual([
      "surface",
      "road_class",
      "foot_access",
      "foot_road_access",
      "bike_access",
      "bike_road_access",
      "distance",
    ]);
  });

  it("builds native round-trip requests with GraphHopper round-trip parameters", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          paths: [
            {
              distance: 12_180,
              time: 2_040_000,
              ascend: 78,
              points: {
                type: "LineString",
                coordinates: [
                  [10.1228, 54.3233],
                  [10.1304, 54.3274],
                  [10.1228, 54.3233],
                ],
              },
              instructions: [
                {
                  distance: 12_180,
                  sign: 4,
                  interval: [2, 2],
                  text: "Arrive at destination",
                  street_name: "",
                },
              ],
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

    await expect(
      adapter.getRoundTripRoute!({
        activity: "running_walking",
        pointCount: 4,
        roundTripDistanceMeters: 12_600,
        roundTripSeed: 123_456,
        start: { lat: 54.3233, lon: 10.1228 },
      }),
    ).resolves.toMatchObject({
      distanceMeters: 12_180,
      geometry: {
        type: "LineString",
        coordinates: [
          [10.1228, 54.3233],
          [10.1304, 54.3274],
          [10.1228, 54.3233],
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(requestUrl as string);

    expect(url.origin).toBe("http://graphhopper:8989");
    expect(url.pathname).toBe("/route");
    expect(url.searchParams.get("point")).toBe("54.3233,10.1228");
    expect(url.searchParams.get("profile")).toBe("foot");
    expect(url.searchParams.get("algorithm")).toBe("round_trip");
    expect(url.searchParams.get("round_trip.distance")).toBe("12600");
    expect(url.searchParams.get("round_trip.seed")).toBe("123456");
    expect(url.searchParams.get("round_trip.points")).toBe("4");
    expect(url.searchParams.get("points_encoded")).toBe("false");
    expect(url.searchParams.get("instructions")).toBe("true");
  });

  it("falls back to unknown surface details when GraphHopper omits path details", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 8_640,
                time: 1_920_000,
                ascend: 64,
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
    ).resolves.toMatchObject({
      distanceMeters: 8_640,
      instructions: [],
      surfaceDetails: [
        {
          bikeAccess: null,
          bikeRoadAccess: null,
          distanceMeters: 8_640,
          footAccess: null,
          footRoadAccess: null,
          surface: null,
          roadClass: null,
        },
      ],
    });
  });

  it("keeps elevation gain unavailable when the adapter is configured without elevation support", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 8_640,
                time: 1_920_000,
                ascend: 64,
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
      ),
      hasElevation: false,
    });

    await expect(
      adapter.getRoute({
        activity: "running_walking",
        points: [
          { lat: 54.3233, lon: 10.1228 },
          { lat: 54.332, lon: 10.141 },
        ],
      }),
    ).resolves.toMatchObject({
      elevationGainMeters: null,
    });
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

  it("throws when GraphHopper instructions point outside the returned geometry", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 5_000,
                points: {
                  type: "LineString",
                  coordinates: [
                    [10.1228, 54.3233],
                    [10.141, 54.332],
                  ],
                },
                instructions: [
                  {
                    distance: 5_000,
                    sign: 0,
                    interval: [4, 4],
                    text: "Continue",
                    street_name: "",
                  },
                ],
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

  it("throws when GraphHopper responds with malformed nearest-point data", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            coordinates: [10.1228],
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
      adapter.snapCoordinate!({
        activity: "cycling",
        coordinate: { lat: 54.3233, lon: 10.1228 },
      }),
    ).rejects.toBeInstanceOf(GraphHopperInvalidResponseError);
  });

  it("maps GraphHopper generic U-turn signs into explicit U-turn instruction types", async () => {
    const adapter = createGraphHopperAdapter({
      baseUrl: "http://graphhopper:8989",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 3_000,
                time: 600_000,
                points: {
                  type: "LineString",
                  coordinates: [
                    [10.1228, 54.3233],
                    [10.1304, 54.3274],
                    [10.141, 54.332],
                  ],
                },
                instructions: [
                  {
                    distance: 1_500,
                    sign: 0,
                    interval: [0, 1],
                    text: "Continue",
                    street_name: "",
                  },
                  {
                    distance: 1_500,
                    sign: -98,
                    interval: [1, 2],
                    text: "Make a U-turn",
                    street_name: "",
                  },
                ],
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
    ).resolves.toMatchObject({
      instructions: [{ type: "depart" }, { type: "u_turn_left" }],
    });
  });
});
