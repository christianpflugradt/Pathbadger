import { describe, expect, it } from "vitest";
import { haversineDistanceMeters } from "@pathbadger/geo";
import type { RouteGeometry } from "@pathbadger/shared";

import {
  createNavigationSnapshot,
  getRouteCoordinateAtFraction,
} from "./navigation-session.js";

describe("getRouteCoordinateAtFraction", () => {
  const routeGeometry = {
    type: "LineString" as const,
    coordinates: [
      [10.0, 54.0],
      [10.02, 54.0],
    ],
  } satisfies RouteGeometry;

  it("clamps the requested progress fraction to the route start", () => {
    expect(getRouteCoordinateAtFraction(routeGeometry, -0.5)).toEqual({
      lat: 54.0,
      lon: 10.0,
    });
  });

  it("returns the route end when the requested progress fraction overshoots", () => {
    expect(getRouteCoordinateAtFraction(routeGeometry, 1.5)).toEqual({
      lat: 54.0,
      lon: 10.02,
    });
  });
});

describe("createNavigationSnapshot", () => {
  const straightRoute = {
    type: "LineString" as const,
    coordinates: [
      [10.0, 54.0],
      [10.02, 54.0],
    ],
  } satisfies RouteGeometry;
  const cornerRoute = {
    type: "LineString" as const,
    coordinates: [
      [10.0, 54.0],
      [10.01, 54.0],
      [10.01, 54.01],
    ],
  } satisfies RouteGeometry;

  it("derives midpoint progress metrics for a straight route", () => {
    const totalDistanceMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.0 },
      { lat: 54.0, lon: 10.02 },
    );
    const snapshot = createNavigationSnapshot(straightRoute, 0.5);

    expect(snapshot.currentPosition.lat).toBeCloseTo(54.0, 6);
    expect(snapshot.currentPosition.lon).toBeCloseTo(10.01, 6);
    expect(snapshot.completedDistanceMeters).toBeCloseTo(
      totalDistanceMeters / 2,
      0,
    );
    expect(snapshot.remainingDistanceMeters).toBeCloseTo(
      totalDistanceMeters / 2,
      0,
    );
    expect(snapshot.totalDistanceMeters).toBeCloseTo(totalDistanceMeters, 0);
    expect(snapshot.progressFraction).toBeCloseTo(0.5, 2);
    expect(snapshot.progressPercent).toBe(50);
  });

  it("continues progress onto later route segments", () => {
    const firstSegmentMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.0 },
      { lat: 54.0, lon: 10.01 },
    );
    const secondSegmentMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.01 },
      { lat: 54.01, lon: 10.01 },
    );
    const totalDistanceMeters = firstSegmentMeters + secondSegmentMeters;
    const snapshot = createNavigationSnapshot(cornerRoute, 0.75);

    expect(snapshot.currentPosition.lon).toBeCloseTo(10.01, 6);
    expect(snapshot.currentPosition.lat).toBeGreaterThan(54.002);
    expect(snapshot.currentPosition.lat).toBeLessThan(54.01);
    expect(snapshot.completedDistanceMeters).toBeCloseTo(
      totalDistanceMeters * 0.75,
      0,
    );
    expect(snapshot.remainingDistanceMeters).toBeCloseTo(
      totalDistanceMeters * 0.25,
      0,
    );
    expect(snapshot.progressPercent).toBe(75);
  });
});
