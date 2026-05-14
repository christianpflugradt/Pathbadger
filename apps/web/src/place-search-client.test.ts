import { describe, expect, it, vi } from "vitest";

import { searchLocalPlaces } from "./place-search-client.js";

describe("searchLocalPlaces", () => {
  it("calls the supported same-origin place-search boundary and parses results", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          query: "Bad Bramstedt",
          results: [
            {
              id: "relation-62364",
              label: "Bad Bramstedt, Schleswig-Holstein, Germany",
              coordinate: {
                lat: 53.9183,
                lon: 9.8877,
              },
            },
          ],
          message: "Found 1 local place match.",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const response = await searchLocalPlaces({
      apiBaseUrl: "/api",
      fetchImpl: fetchMock,
      query: "Bad Bramstedt",
    });

    expect(response.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toBe(
      "/api/places/search?query=Bad+Bramstedt&limit=5",
    );
  });

  it("surfaces API error messages for non-ok responses", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_place_search_request",
          message: "Search queries must contain at least two characters.",
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
      searchLocalPlaces({
        apiBaseUrl: "/api/",
        fetchImpl: fetchMock,
        query: "a",
      }),
    ).rejects.toThrow("Search queries must contain at least two characters.");
  });

  it("rejects malformed successful payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          query: "Bad Bramstedt",
          results: [
            {
              label: "Missing id field",
            },
          ],
          message: "Found 1 local place match.",
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
      searchLocalPlaces({
        apiBaseUrl: "/api",
        fetchImpl: fetchMock,
        query: "Bad Bramstedt",
      }),
    ).rejects.toThrow("API returned an unexpected local place-search payload.");
  });

  it("falls back to the same-origin root path when the api base is blank", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "unavailable",
          query: "Bad Bramstedt",
          results: [],
          message: "Local place search is unavailable.",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    await searchLocalPlaces({
      apiBaseUrl: "   ",
      fetchImpl: fetchMock,
      query: "Bad Bramstedt",
    });

    const [requestUrl] = fetchMock.mock.calls[0] ?? [];

    expect(String(requestUrl)).toBe(
      "/places/search?query=Bad+Bramstedt&limit=5",
    );
  });
});
