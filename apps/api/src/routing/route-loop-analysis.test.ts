import { describe, expect, it } from "vitest";

import {
  MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS,
  MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS,
  MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS,
  routeMeetsSupportedRoundTripContract,
  summarizeRouteLoop,
} from "./route-loop-analysis.js";

describe("summarizeRouteLoop", () => {
  it("reports a clean loop for a square course that returns to the start", () => {
    const summary = summarizeRouteLoop({
      requestedStart: { lat: 54.0, lon: 10.0 },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.0, 54.0],
          [10.01, 54.0],
          [10.01, 54.01],
          [10.0, 54.01],
          [10.0, 54.0],
        ],
      },
    });

    expect(summary).toEqual({
      startOffsetMeters: 0,
      endOffsetMeters: 0,
      closureGapMeters: 0,
      bidirectionalOverlapMeters: 0,
    });
    expect(routeMeetsSupportedRoundTripContract(summary)).toBe(true);
  });

  it("detects a long out-and-back retrace as unsupported overlap", () => {
    const summary = summarizeRouteLoop({
      requestedStart: { lat: 54.0, lon: 10.0 },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.0, 54.0],
          [10.0, 54.01],
          [10.0, 54.02],
          [10.0, 54.01],
          [10.0, 54.0],
        ],
      },
    });

    expect(summary.startOffsetMeters).toBe(0);
    expect(summary.endOffsetMeters).toBe(0);
    expect(summary.closureGapMeters).toBe(0);
    expect(summary.bidirectionalOverlapMeters).toBeGreaterThan(
      MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS,
    );
    expect(routeMeetsSupportedRoundTripContract(summary)).toBe(false);
  });

  it("flags a route that does not return closely enough to the requested start area", () => {
    const summary = summarizeRouteLoop({
      requestedStart: { lat: 54.0, lon: 10.0 },
      geometry: {
        type: "LineString",
        coordinates: [
          [10.0015, 54.0015],
          [10.01, 54.005],
          [10.0015, 54.0015],
        ],
      },
    });

    expect(summary.startOffsetMeters).toBeGreaterThan(
      MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS,
    );
    expect(summary.endOffsetMeters).toBeGreaterThan(
      MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS,
    );
    expect(summary.closureGapMeters).toBeLessThanOrEqual(
      MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS,
    );
    expect(routeMeetsSupportedRoundTripContract(summary)).toBe(false);
  });
});
