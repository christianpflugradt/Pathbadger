import { describe, expect, it } from "vitest";

import {
  getNavigationTrackingBannerClassName,
  getNavigationTrackingBannerCopy,
  getNavigationTrackingBannerTitle,
  getNavigationTrackingPanelCopy,
  getNavigationTrackingStatusLabel,
  getNavigationTrackingStatusPillClassName,
} from "./navigation-tracking-state.js";

describe("navigation tracking state", () => {
  it("stays active when a fresh live GPS position is available", () => {
    const options = {
      browserGeolocation: {
        errorCode: null,
        message: "Using the latest browser GPS fix.",
        position: null,
        status: "ready" as const,
      },
      hasFreshPosition: true,
      hasTrackedPosition: true,
    };

    expect(getNavigationTrackingPanelCopy(options)).toContain(
      "following the route from live browser geolocation",
    );
    expect(getNavigationTrackingStatusLabel(options)).toBe("Live GPS feed");
    expect(getNavigationTrackingStatusPillClassName(options)).toBe(
      "status-pill--active",
    );
    expect(getNavigationTrackingBannerClassName(options)).toBe("");
    expect(getNavigationTrackingBannerTitle(options)).toBe(
      "Live browser geolocation active",
    );
    expect(getNavigationTrackingBannerCopy(options)).toContain(
      "navigation metrics are updating from the browser GPS feed",
    );
  });

  it("surfaces an explicit blocked state when permission is denied after a real fix", () => {
    const options = {
      browserGeolocation: {
        errorCode: "permission_denied" as const,
        message: "User denied Geolocation",
        position: {
          accuracyMeters: 6,
          coordinate: { lat: 54.33, lon: 10.12 },
          headingDegrees: null,
          speedMetersPerSecond: null,
          timestampMs: 1_762_744_900_000,
        },
        status: "denied" as const,
      },
      hasFreshPosition: false,
      hasTrackedPosition: true,
    };

    expect(getNavigationTrackingPanelCopy(options)).toContain(
      "permission is now denied",
    );
    expect(getNavigationTrackingStatusLabel(options)).toBe("GPS feed blocked");
    expect(getNavigationTrackingStatusPillClassName(options)).toBe(
      "status-pill--error",
    );
    expect(getNavigationTrackingBannerClassName(options)).toBe(
      " response-banner--error",
    );
    expect(getNavigationTrackingBannerTitle(options)).toBe(
      "Live GPS permission lost",
    );
    expect(getNavigationTrackingBannerCopy(options)).toContain(
      "live geolocation is blocked",
    );
    expect(getNavigationTrackingBannerCopy(options)).toContain(
      "User denied Geolocation",
    );
  });

  it("keeps the last-fix state as a warning while a new GPS update is still pending", () => {
    const options = {
      browserGeolocation: {
        errorCode: null,
        message: "Waiting for browser permission and a usable GPS fix.",
        position: {
          accuracyMeters: 9,
          coordinate: { lat: 54.33, lon: 10.12 },
          headingDegrees: null,
          speedMetersPerSecond: null,
          timestampMs: 1_762_744_900_000,
        },
        status: "requesting" as const,
      },
      hasFreshPosition: false,
      hasTrackedPosition: true,
    };

    expect(getNavigationTrackingStatusLabel(options)).toBe("Last GPS fix held");
    expect(getNavigationTrackingStatusPillClassName(options)).toBe(
      "status-pill--warning",
    );
    expect(getNavigationTrackingBannerClassName(options)).toBe(
      " response-banner--pending",
    );
    expect(getNavigationTrackingBannerTitle(options)).toBe(
      "Holding the last known GPS fix",
    );
  });
});
