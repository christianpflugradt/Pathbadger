import { describe, expect, it } from "vitest";
import { haversineDistanceMeters } from "@pathbadger/geo";
import type { RouteGeometry, RouteInstruction } from "@pathbadger/shared";

import {
  createNavigationSnapshot,
  DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS,
  getNextNavigationInstruction,
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

describe("getNextNavigationInstruction", () => {
  const instructions = [
    {
      distanceFromStartMeters: 0,
      distanceToNextMeters: 650,
      type: "depart",
      text: "Leave the trailhead",
      streetName: null,
      coordinate: [10.0, 54.0],
    },
    {
      distanceFromStartMeters: 650,
      distanceToNextMeters: 500,
      type: "turn_right",
      text: "Turn right onto Forest path",
      streetName: "Forest path",
      coordinate: [10.01, 54.0],
    },
    {
      distanceFromStartMeters: 1_150,
      distanceToNextMeters: null,
      type: "arrive",
      text: "Arrive at destination",
      streetName: null,
      coordinate: [10.02, 54.0],
    },
  ] satisfies RouteInstruction[];

  it("selects the nearest upcoming instruction and remaining distance", () => {
    expect(getNextNavigationInstruction(instructions, 700)).toEqual({
      distanceMeters: 450,
      instruction: instructions[2],
    });
  });

  it("stays honest when no instruction data is available", () => {
    expect(getNextNavigationInstruction([], 400)).toBeNull();
    expect(getNextNavigationInstruction(null, 400)).toBeNull();
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
  const instructions = [
    {
      distanceFromStartMeters: 0,
      distanceToNextMeters: 750,
      type: "depart",
      text: "Start route",
      streetName: null,
      coordinate: [10.0, 54.0],
    },
    {
      distanceFromStartMeters: 750,
      distanceToNextMeters: null,
      type: "arrive",
      text: "Arrive at destination",
      streetName: null,
      coordinate: [10.02, 54.0],
    },
  ] satisfies RouteInstruction[];

  it("derives midpoint progress metrics for a straight route", () => {
    const totalDistanceMeters = haversineDistanceMeters(
      { lat: 54.0, lon: 10.0 },
      { lat: 54.0, lon: 10.02 },
    );
    const snapshot = createNavigationSnapshot(straightRoute, {
      requestedProgressFraction: 0.5,
    });

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
    expect(snapshot.isOffRoute).toBe(false);
    expect(snapshot.offRouteDistanceMeters).toBeCloseTo(0, 6);
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
    const snapshot = createNavigationSnapshot(cornerRoute, {
      requestedProgressFraction: 0.75,
    });

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

  it("selects the next upcoming instruction from current progress", () => {
    const snapshot = createNavigationSnapshot(straightRoute, {
      instructions,
      requestedProgressFraction: 0.25,
    });

    expect(snapshot.nextInstruction?.instruction.text).toBe(
      "Arrive at destination",
    );
    expect(snapshot.nextInstruction?.distanceMeters).toBeGreaterThan(300);
  });

  it("uses a live current position instead of the simulated progress fraction", () => {
    const snapshot = createNavigationSnapshot(straightRoute, {
      currentPosition: {
        lat: 54.0,
        lon: 10.015,
      },
      requestedProgressFraction: 0,
    });

    expect(snapshot.currentPosition).toEqual({
      lat: 54.0,
      lon: 10.015,
    });
    expect(snapshot.progressFraction).toBeGreaterThan(0.7);
    expect(snapshot.progressFraction).toBeLessThan(0.8);
    expect(snapshot.offRouteDistanceMeters).toBeCloseTo(0, 6);
  });

  it("uses a preferred live progress hint to stay near the route start on repeated geometry", () => {
    const repeatedRoute = {
      type: "LineString" as const,
      coordinates: [
        [10.0, 54.0],
        [10.01, 54.0],
        [10.01, 54.01],
        [10.0, 54.01],
        [10.0, 54.0],
        [10.01, 54.0],
      ],
    } satisfies RouteGeometry;

    const snapshot = createNavigationSnapshot(repeatedRoute, {
      currentPosition: {
        lat: 54.0,
        lon: 10.0,
      },
      preferredDistanceFromStartMeters: 0,
      requestedProgressFraction: 0,
    });

    expect(snapshot.completedDistanceMeters).toBeLessThan(10);
    expect(snapshot.progressFraction).toBeLessThan(0.05);
  });

  it("warns when the current position exceeds the conservative off-route threshold", () => {
    const snapshot = createNavigationSnapshot(straightRoute, {
      lateralOffsetMeters: DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS + 15,
      requestedProgressFraction: 0.5,
    });

    expect(snapshot.offRouteDistanceMeters).toBeGreaterThan(
      DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS,
    );
    expect(snapshot.isOffRoute).toBe(true);
    expect(snapshot.snappedPosition.lat).toBeCloseTo(54.0, 6);
  });

  it("stays on route when the deviation stays under the warning threshold", () => {
    const snapshot = createNavigationSnapshot(straightRoute, {
      lateralOffsetMeters: DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS - 15,
      requestedProgressFraction: 0.5,
    });

    expect(snapshot.offRouteDistanceMeters).toBeLessThan(
      DEFAULT_OFF_ROUTE_WARNING_THRESHOLD_METERS,
    );
    expect(snapshot.isOffRoute).toBe(false);
  });
});
