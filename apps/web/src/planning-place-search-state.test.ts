import { describe, expect, it } from "vitest";

import {
  createMapPassThroughPoint,
  createSearchPassThroughPoint,
  createSearchStartSelection,
  getPassThroughPointSourceCopy,
  getPlaceSearchFeedbackClassName,
  getPlaceSearchFeedbackCopy,
  getPlaceSearchRegionGuardrailCopy,
} from "./planning-place-search-state.js";

describe("planning place search state", () => {
  it("creates a searched start selection that preserves label and coordinates", () => {
    const startSelection = createSearchStartSelection({
      id: "relation-62364",
      label: "Bad Bramstedt, Schleswig-Holstein, Germany",
      coordinate: {
        lat: 53.9183,
        lon: 9.8877,
      },
    });

    expect(startSelection).toEqual({
      coordinate: {
        lat: 53.9183,
        lon: 9.8877,
      },
      label: "Bad Bramstedt, Schleswig-Holstein, Germany",
      source: "search",
    });
  });

  it("keeps search-created pass-through points explicit", () => {
    const point = createSearchPassThroughPoint({
      id: "search-waypoint-4",
      result: {
        id: "relation-62364",
        label: "Bad Bramstedt, Schleswig-Holstein, Germany",
        coordinate: {
          lat: 53.9183,
          lon: 9.8877,
        },
      },
    });

    expect(point.label).toBe("Bad Bramstedt, Schleswig-Holstein, Germany");
    expect(getPassThroughPointSourceCopy(point.source)).toBe(
      "Local search result",
    );
  });

  it("keeps map-created pass-through points distinct from searched points", () => {
    const point = createMapPassThroughPoint({
      coordinate: {
        lat: 53.919,
        lon: 9.888,
      },
      id: "map-waypoint-2",
      index: 2,
    });

    expect(point.label).toBe("Map waypoint 2");
    expect(getPassThroughPointSourceCopy(point.source)).toBe("Map click");
  });

  it("returns success feedback that explains how the planner can apply results", () => {
    expect(
      getPlaceSearchFeedbackCopy({
        errorMessage: null,
        isLoading: false,
        regionName: "Schleswig-Holstein",
        response: {
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
        },
      }),
    ).toBe(
      "Found 1 local place match. Use a match as the route start or add it as a waypoint.",
    );
    expect(
      getPlaceSearchFeedbackClassName({
        errorMessage: null,
        isLoading: false,
        regionName: "Schleswig-Holstein",
        response: {
          status: "success",
          query: "Bad Bramstedt",
          results: [],
          message: "Found 1 local place match.",
        },
      }),
    ).toBe("helper-copy--active");
  });

  it("keeps unavailable search honest without hiding map clicks", () => {
    expect(
      getPlaceSearchFeedbackCopy({
        errorMessage: null,
        isLoading: false,
        regionName: "Schleswig-Holstein",
        response: {
          status: "unavailable",
          query: "Bad Bramstedt",
          results: [],
          message:
            "Local place search is unavailable because PLACE_SEARCH_PROVIDER_URL is not configured.",
        },
      }),
    ).toContain("place the start or waypoints directly on the map");
    expect(
      getPlaceSearchFeedbackClassName({
        errorMessage: null,
        isLoading: false,
        regionName: "Schleswig-Holstein",
        response: {
          status: "unavailable",
          query: "Bad Bramstedt",
          results: [],
          message:
            "Local place search is unavailable because PLACE_SEARCH_PROVIDER_URL is not configured.",
        },
      }),
    ).toBe("helper-copy--warning");
  });

  it("keeps the Schleswig-Holstein routing guardrail explicit", () => {
    expect(getPlaceSearchRegionGuardrailCopy("Schleswig-Holstein")).toContain(
      "Schleswig-Holstein",
    );
  });
});
