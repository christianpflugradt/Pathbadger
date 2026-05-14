import { describe, expect, it, vi } from "vitest";

import {
  createPlaceSearchService,
  createPlaceSearchServiceFromEnv,
} from "./place-search-service.js";

describe("createPlaceSearchService", () => {
  it("returns an honest unavailable response when no provider is configured", async () => {
    const service = createPlaceSearchService({
      fetchImpl: vi.fn(),
      providerUrl: null,
    });

    await expect(
      service.searchPlaces({
        query: "Bad Bramstedt",
        limit: 5,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      query: "Bad Bramstedt",
      results: [],
      message:
        "Local place search is unavailable because PLACE_SEARCH_PROVIDER_URL is not configured.",
    });
  });

  it("normalizes successful Nominatim-style provider results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        {
          place_id: 123,
          osm_id: 62644,
          osm_type: "relation",
          display_name: "Bad Bramstedt, Schleswig-Holstein, Deutschland",
          lat: "53.9188",
          lon: "9.8872",
        },
      ]),
    });
    const service = createPlaceSearchService({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      providerUrl: "http://nominatim:8080",
    });

    await expect(
      service.searchPlaces({
        query: "Bad Bramstedt",
        limit: 3,
      }),
    ).resolves.toEqual({
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

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const requestUrl = fetchImpl.mock.calls[0]?.[0];

    expect(requestUrl).toBeInstanceOf(URL);
    expect(String(requestUrl)).toBe(
      "http://nominatim:8080/search?format=jsonv2&q=Bad+Bramstedt&limit=3&addressdetails=0",
    );
  });

  it("returns an honest empty response when the provider has no matches", async () => {
    const service = createPlaceSearchService({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([]),
      }) as unknown as typeof fetch,
      providerUrl: "http://nominatim:8080/search",
    });

    await expect(
      service.searchPlaces({
        query: "No Such Place",
        limit: 5,
      }),
    ).resolves.toEqual({
      status: "empty",
      query: "No Such Place",
      results: [],
      message: 'No local places matched "No Such Place".',
    });
  });

  it("returns unavailable when the provider responds with an error", async () => {
    const service = createPlaceSearchService({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }) as unknown as typeof fetch,
      providerUrl: "http://nominatim:8080",
    });

    await expect(
      service.searchPlaces({
        query: "Kiel",
        limit: 5,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      query: "Kiel",
      results: [],
      message:
        "Local place search is unavailable because the configured provider returned 503.",
    });
  });
});

describe("createPlaceSearchServiceFromEnv", () => {
  it("reads the provider URL from the environment", async () => {
    const previousProviderUrl = process.env.PLACE_SEARCH_PROVIDER_URL;
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });

    process.env.PLACE_SEARCH_PROVIDER_URL = "http://nominatim:8080";
    const service = createPlaceSearchServiceFromEnv(
      fetchImpl as unknown as typeof fetch,
    );

    await service.searchPlaces({
      query: "Kiel",
      limit: 5,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    if (previousProviderUrl === undefined) {
      delete process.env.PLACE_SEARCH_PROVIDER_URL;
      return;
    }

    process.env.PLACE_SEARCH_PROVIDER_URL = previousProviderUrl;
  });
});
