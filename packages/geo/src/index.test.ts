import { describe, expect, it } from "vitest";

import {
  calculateRouteProgress,
  haversineDistanceMeters,
  kilometersToMeters,
} from "./index.js";

describe("kilometersToMeters", () => {
  it("converts kilometers to meters", () => {
    expect(kilometersToMeters(2.5)).toBe(2_500);
  });
});

describe("haversineDistanceMeters", () => {
  it("returns zero for identical coordinates", () => {
    expect(
      haversineDistanceMeters(
        { lat: 54.3233, lon: 10.1228 },
        { lat: 54.3233, lon: 10.1228 },
      ),
    ).toBe(0);
  });

  it("returns a positive distance for nearby coordinates", () => {
    expect(
      haversineDistanceMeters(
        { lat: 54.3233, lon: 10.1228 },
        { lat: 54.3291, lon: 10.1361 },
      ),
    ).toBeGreaterThan(0);
  });
});

describe("calculateRouteProgress", () => {
  const straightRoute = [
    [10.0, 54.0],
    [10.02, 54.0],
  ] as const;
  const cornerRoute = [
    [10.0, 54.0],
    [10.01, 54.0],
    [10.01, 54.01],
  ] as const;

  it("reports zero completed distance at the route start", () => {
    const totalDistanceMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.0 },
      { lat: 54.0, lon: 10.02 },
    );
    const progress = calculateRouteProgress(straightRoute, {
      lat: 54.0,
      lon: 10.0,
    });

    expect(progress.nearestPoint).toEqual({ lat: 54.0, lon: 10.0 });
    expect(progress.nearestSegmentIndex).toBe(0);
    expect(progress.distanceFromStartMeters).toBeCloseTo(0, 6);
    expect(progress.remainingDistanceMeters).toBeCloseTo(
      totalDistanceMeters,
      6,
    );
    expect(progress.totalDistanceMeters).toBeCloseTo(totalDistanceMeters, 6);
    expect(progress.offRouteDistanceMeters).toBeCloseTo(0, 6);
    expect(progress.progressFraction).toBe(0);
  });

  it("snaps an off-route position back onto the current segment", () => {
    const totalDistanceMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.0 },
      { lat: 54.0, lon: 10.02 },
    );
    const progress = calculateRouteProgress(straightRoute, {
      lat: 54.001,
      lon: 10.01,
    });

    expect(progress.nearestPoint.lat).toBeCloseTo(54.0, 6);
    expect(progress.nearestPoint.lon).toBeCloseTo(10.01, 6);
    expect(progress.distanceFromStartMeters).toBeCloseTo(
      totalDistanceMeters / 2,
      0,
    );
    expect(progress.remainingDistanceMeters).toBeCloseTo(
      totalDistanceMeters / 2,
      0,
    );
    expect(progress.offRouteDistanceMeters).toBeGreaterThan(100);
    expect(progress.progressFraction).toBeCloseTo(0.5, 2);
  });

  it("carries completed distance across multiple route segments", () => {
    const firstSegmentMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.0 },
      { lat: 54.0, lon: 10.01 },
    );
    const secondSegmentMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.01 },
      { lat: 54.01, lon: 10.01 },
    );
    const progress = calculateRouteProgress(cornerRoute, {
      lat: 54.005,
      lon: 10.0108,
    });

    expect(progress.nearestSegmentIndex).toBe(1);
    expect(progress.nearestPoint.lon).toBeCloseTo(10.01, 6);
    expect(progress.nearestPoint.lat).toBeCloseTo(54.005, 3);
    expect(progress.distanceFromStartMeters).toBeCloseTo(
      firstSegmentMeters + secondSegmentMeters / 2,
      0,
    );
    expect(progress.remainingDistanceMeters).toBeCloseTo(
      secondSegmentMeters / 2,
      0,
    );
    expect(progress.offRouteDistanceMeters).toBeGreaterThan(50);
  });

  it("clamps progress to the route end when the position passes the final point", () => {
    const totalDistanceMeters =
      haversineDistanceMeters(
        { lat: 54.0, lon: 10.0 },
        { lat: 54.0, lon: 10.01 },
      ) +
      haversineDistanceMeters(
        { lat: 54.0, lon: 10.01 },
        { lat: 54.01, lon: 10.01 },
      );
    const progress = calculateRouteProgress(cornerRoute, {
      lat: 54.02,
      lon: 10.01,
    });

    expect(progress.nearestSegmentIndex).toBe(1);
    expect(progress.nearestPoint).toEqual({ lat: 54.01, lon: 10.01 });
    expect(progress.distanceFromStartMeters).toBeCloseTo(
      totalDistanceMeters,
      6,
    );
    expect(progress.remainingDistanceMeters).toBeCloseTo(0, 6);
    expect(progress.progressFraction).toBeCloseTo(1, 6);
  });

  it("rejects route polylines with fewer than two coordinates", () => {
    expect(() =>
      calculateRouteProgress([[10.0, 54.0]], {
        lat: 54.0,
        lon: 10.0,
      }),
    ).toThrow(/at least two coordinates/i);
  });
});
