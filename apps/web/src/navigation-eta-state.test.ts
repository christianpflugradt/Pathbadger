import { describe, expect, it } from "vitest";

import {
  formatNavigationEtaHours,
  getNavigationEtaState,
  MIN_NAVIGATION_ETA_SPEED_KMH,
} from "./navigation-eta-state.js";

describe("navigation ETA state", () => {
  it("prefers average speed when timestamped route progress is available", () => {
    expect(
      getNavigationEtaState({
        averageSpeedKmh: 12,
        currentSpeedKmh: 14,
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        remainingDistanceMeters: 6_000,
      }),
    ).toEqual({
      estimateLabel: "30 min",
      helperCopy:
        "Estimated remaining time is using timestamped average route progress, so it will smooth over short pace swings.",
      isAvailable: true,
      source: "average_speed",
    });
  });

  it("falls back to the current speed sample when average pace is not ready yet", () => {
    expect(
      getNavigationEtaState({
        averageSpeedKmh: null,
        currentSpeedKmh: 9,
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        remainingDistanceMeters: 4_500,
      }),
    ).toEqual({
      estimateLabel: "30 min",
      helperCopy:
        "Estimated remaining time is using the latest fresh browser speed sample and may swing as your pace changes.",
      isAvailable: true,
      source: "current_speed",
    });
  });

  it("keeps the estimate unavailable while GPS confidence is low", () => {
    expect(
      getNavigationEtaState({
        averageSpeedKmh: 10,
        currentSpeedKmh: 11,
        hasFreshPosition: false,
        hasLowConfidencePosition: true,
        hasTrackedPosition: true,
        remainingDistanceMeters: 3_000,
      }),
    ).toEqual({
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time stays unavailable while the latest live GPS fix is low-confidence or stale.",
      isAvailable: false,
      source: null,
    });
  });

  it("keeps the estimate unavailable until route progress and speed evidence exist", () => {
    expect(
      getNavigationEtaState({
        averageSpeedKmh: null,
        currentSpeedKmh: null,
        hasFreshPosition: false,
        hasLowConfidencePosition: false,
        hasTrackedPosition: false,
        remainingDistanceMeters: null,
      }),
    ).toEqual({
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time will appear once browser geolocation produces route progress and a defensible speed estimate.",
      isAvailable: false,
      source: null,
    });
  });

  it("requires a speed estimate that is steady enough to trust", () => {
    expect(
      getNavigationEtaState({
        averageSpeedKmh: MIN_NAVIGATION_ETA_SPEED_KMH - 0.1,
        currentSpeedKmh: MIN_NAVIGATION_ETA_SPEED_KMH - 0.2,
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        remainingDistanceMeters: 2_000,
      }),
    ).toEqual({
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time waits for either a steady live speed sample or enough timestamped route progress to support an honest average pace.",
      isAvailable: false,
      source: null,
    });
  });

  it("formats longer ETAs in hours and minutes", () => {
    expect(formatNavigationEtaHours(2.25)).toBe("2 hr 15 min");
    expect(formatNavigationEtaHours(0.01)).toBe("<1 min");
  });
});
