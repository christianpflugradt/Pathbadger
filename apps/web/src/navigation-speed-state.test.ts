import { describe, expect, it } from "vitest";

import {
  createNavigationSpeedBaseline,
  formatNavigationSpeedKmh,
  getNavigationSpeedHelperCopy,
  getNavigationSpeedMetrics,
} from "./navigation-speed-state.js";

describe("navigation speed state", () => {
  const position = {
    accuracyMeters: 6,
    coordinate: { lat: 54.33, lon: 10.12 },
    headingDegrees: null,
    speedMetersPerSecond: 4.5,
    timestampMs: 2_000,
  } as const;
  const snapshot = {
    completedDistanceMeters: 250,
  } as const;

  it("derives current speed and timestamp-based average speed", () => {
    const baseline = createNavigationSpeedBaseline({
      position: {
        ...position,
        timestampMs: 1_000,
      },
      snapshot: {
        ...snapshot,
        completedDistanceMeters: 245,
      },
    });

    const metrics = getNavigationSpeedMetrics({
      baseline,
      hasFreshPosition: true,
      position,
      snapshot: {
        ...snapshot,
        completedDistanceMeters: 255,
      },
    });

    expect(metrics.currentSpeedKmh).toBeCloseTo(16.2, 6);
    expect(metrics.averageSpeedKmh).toBeCloseTo(36, 6);
  });

  it("keeps current speed unavailable when the GPS fix is stale", () => {
    const baseline = createNavigationSpeedBaseline({
      position: {
        ...position,
        timestampMs: 1_000,
      },
      snapshot,
    });

    const metrics = getNavigationSpeedMetrics({
      baseline,
      hasFreshPosition: false,
      position,
      snapshot: {
        ...snapshot,
        completedDistanceMeters: 260,
      },
    });

    expect(metrics.currentSpeedKmh).toBeNull();
    expect(metrics.averageSpeedKmh).toBeCloseTo(36, 6);
  });

  it("stays honest when the browser does not provide stable speed data", () => {
    const metrics = getNavigationSpeedMetrics({
      baseline: null,
      hasFreshPosition: true,
      position: {
        ...position,
        speedMetersPerSecond: null,
      },
      snapshot,
    });

    expect(metrics.currentSpeedKmh).toBeNull();
    expect(metrics.averageSpeedKmh).toBeNull();
    expect(formatNavigationSpeedKmh(metrics.currentSpeedKmh)).toBe(
      "Unavailable",
    );
    expect(
      getNavigationSpeedHelperCopy({
        averageSpeedKmh: metrics.averageSpeedKmh,
        baseline: null,
        currentSpeedKmh: metrics.currentSpeedKmh,
        hasFreshPosition: true,
      }),
    ).toContain("not exposing a stable instantaneous speed sample");
  });

  it("waits for a second timestamped progress update before showing average speed", () => {
    const baseline = createNavigationSpeedBaseline({
      position,
      snapshot,
    });

    const metrics = getNavigationSpeedMetrics({
      baseline,
      hasFreshPosition: true,
      position,
      snapshot,
    });

    expect(metrics.averageSpeedKmh).toBeNull();
    expect(
      getNavigationSpeedHelperCopy({
        averageSpeedKmh: metrics.averageSpeedKmh,
        baseline,
        currentSpeedKmh: metrics.currentSpeedKmh,
        hasFreshPosition: true,
      }),
    ).toContain("Average speed will appear");
  });
});
