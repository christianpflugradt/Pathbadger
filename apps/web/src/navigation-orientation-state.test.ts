import { describe, expect, it } from "vitest";

import { MIN_HEADING_SPEED_MPS } from "./navigation-orientation-state.js";
import {
  getNavigationOrientationModeOptions,
  getNavigationOrientationState,
} from "./navigation-orientation-state.js";

describe("navigation orientation state", () => {
  it("surfaces the north-up and heading-up options", () => {
    expect(getNavigationOrientationModeOptions()).toEqual([
      {
        mode: "north_up",
        label: "North up",
        detail:
          "Keeps north fixed and avoids rotation even when live browser heading data is available.",
      },
      {
        mode: "heading_up",
        label: "Heading up",
        detail:
          "Rotates only when the browser reports a trustworthy live heading and Battery saver is not active.",
      },
    ]);
  });

  it("keeps north-up as the active orientation by default", () => {
    expect(
      getNavigationOrientationState({
        followMode: "follow_position",
        hasFreshPosition: false,
        hasLowConfidencePosition: false,
        hasTrackedPosition: false,
        isNavigationActive: false,
        mode: "north_up",
        position: null,
        runtimeMode: "normal",
      }),
    ).toMatchObject({
      appliedBearingDegrees: 0,
      indicatorLabel: "North up",
      isHeadingUpActive: false,
      statusLabel: "North up",
      statusPillClassName: "status-pill--active",
    });
  });

  it("describes north-up behavior in the helper summary when north-up is selected", () => {
    expect(
      getNavigationOrientationState({
        followMode: "follow_position",
        hasFreshPosition: false,
        hasLowConfidencePosition: false,
        hasTrackedPosition: false,
        isNavigationActive: false,
        mode: "north_up",
        position: null,
        runtimeMode: "normal",
      }).helperCopy,
    ).toBe(
      "North-up is selected. Once navigation starts, Pathbadger will keep the map aligned to north instead of rotating around browser heading data.",
    );
  });

  it("keeps the helper summary north-up even when live heading data exists", () => {
    const helperCopy = getNavigationOrientationState({
      followMode: "follow_position",
      hasFreshPosition: true,
      hasLowConfidencePosition: false,
      hasTrackedPosition: true,
      isNavigationActive: true,
      mode: "north_up",
      position: {
        accuracyMeters: 6,
        coordinate: {
          lat: 53.9167,
          lon: 9.8833,
        },
        headingDegrees: 91,
        speedMetersPerSecond: MIN_HEADING_SPEED_MPS + 1,
        timestampMs: 1_762_700_000_000,
      },
      runtimeMode: "normal",
    }).helperCopy;

    expect(helperCopy).toBe(
      "North-up is active. Pathbadger is keeping the map aligned to north instead of rotating around browser heading data.",
    );
    expect(helperCopy).not.toContain("Heading-up is armed");
  });

  it("activates heading-up when heading data is fresh and trustworthy", () => {
    expect(
      getNavigationOrientationState({
        followMode: "follow_position",
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        isNavigationActive: true,
        mode: "heading_up",
        position: {
          accuracyMeters: 6,
          coordinate: {
            lat: 53.9167,
            lon: 9.8833,
          },
          headingDegrees: 91,
          speedMetersPerSecond: MIN_HEADING_SPEED_MPS + 1,
          timestampMs: 1_762_700_000_000,
        },
        runtimeMode: "normal",
      }),
    ).toMatchObject({
      appliedBearingDegrees: 91,
      indicatorLabel: "Heading up 91° E",
      isHeadingUpActive: true,
      statusLabel: "Heading up 91° E",
      statusPillClassName: "status-pill--active",
    });
  });

  it("describes heading-up as armed only when heading-up is the selected mode", () => {
    expect(
      getNavigationOrientationState({
        followMode: "follow_position",
        hasFreshPosition: false,
        hasLowConfidencePosition: false,
        hasTrackedPosition: false,
        isNavigationActive: false,
        mode: "heading_up",
        position: null,
        runtimeMode: "normal",
      }).helperCopy,
    ).toBe(
      "Heading-up is armed. Once navigation starts, Pathbadger will rotate the map only after the browser reports a fresh current position and heading.",
    );
  });

  it("falls back honestly when battery saver is active", () => {
    expect(
      getNavigationOrientationState({
        followMode: "follow_position",
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        isNavigationActive: true,
        mode: "heading_up",
        position: {
          accuracyMeters: 6,
          coordinate: {
            lat: 53.9167,
            lon: 9.8833,
          },
          headingDegrees: 91,
          speedMetersPerSecond: MIN_HEADING_SPEED_MPS + 1,
          timestampMs: 1_762_700_000_000,
        },
        runtimeMode: "battery_saver",
      }),
    ).toMatchObject({
      appliedBearingDegrees: 0,
      indicatorLabel: "North up fallback",
      isHeadingUpActive: false,
      statusLabel: "Heading-up pending",
      statusPillClassName: "status-pill--warning",
    });
  });

  it("falls back honestly when the browser is not exposing heading yet", () => {
    expect(
      getNavigationOrientationState({
        followMode: "follow_position",
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        isNavigationActive: true,
        mode: "heading_up",
        position: {
          accuracyMeters: 6,
          coordinate: {
            lat: 53.9167,
            lon: 9.8833,
          },
          headingDegrees: null,
          speedMetersPerSecond: MIN_HEADING_SPEED_MPS + 1,
          timestampMs: 1_762_700_000_000,
        },
        runtimeMode: "normal",
      }).helperCopy,
    ).toContain("not exposing a usable heading sample yet");
  });

  it("pauses heading-up while manual map view is active", () => {
    expect(
      getNavigationOrientationState({
        followMode: "manual_pan",
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        isNavigationActive: true,
        mode: "heading_up",
        position: {
          accuracyMeters: 6,
          coordinate: {
            lat: 53.9167,
            lon: 9.8833,
          },
          headingDegrees: 91,
          speedMetersPerSecond: MIN_HEADING_SPEED_MPS + 1,
          timestampMs: 1_762_700_000_000,
        },
        runtimeMode: "normal",
      }).helperCopy,
    ).toContain("manual map view is active");
  });
});
