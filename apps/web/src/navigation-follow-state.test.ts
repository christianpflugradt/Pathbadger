import { describe, expect, it } from "vitest";

import {
  getNavigationFollowModeActionLabel,
  getNavigationFollowModeHelperCopy,
  getNavigationFollowModeLabel,
  getNavigationFollowModeStatusPillClassName,
} from "./navigation-follow-state.js";

describe("getNavigationFollowModeLabel", () => {
  it("describes live auto-follow explicitly", () => {
    expect(getNavigationFollowModeLabel("follow_position")).toBe(
      "Following position",
    );
  });

  it("describes a manual pan escape explicitly", () => {
    expect(getNavigationFollowModeLabel("manual_pan")).toBe("Manual map view");
  });
});

describe("getNavigationFollowModeStatusPillClassName", () => {
  it("treats active follow mode as an active status", () => {
    expect(getNavigationFollowModeStatusPillClassName("follow_position")).toBe(
      "status-pill--active",
    );
  });

  it("treats manual pan mode as a warning status", () => {
    expect(getNavigationFollowModeStatusPillClassName("manual_pan")).toBe(
      "status-pill--warning",
    );
  });
});

describe("getNavigationFollowModeHelperCopy", () => {
  it("explains that manual pan pauses follow until recentered", () => {
    expect(
      getNavigationFollowModeHelperCopy({
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        mode: "manual_pan",
      }),
    ).toContain("paused after a manual pan");
  });

  it("describes immediate live follow when a fresh GPS fix exists", () => {
    expect(
      getNavigationFollowModeHelperCopy({
        hasFreshPosition: true,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        mode: "follow_position",
      }),
    ).toContain("live browser GPS position");
  });

  it("describes waiting for GPS when follow is enabled without a usable fix", () => {
    expect(
      getNavigationFollowModeHelperCopy({
        hasFreshPosition: false,
        hasLowConfidencePosition: false,
        hasTrackedPosition: false,
        mode: "follow_position",
      }),
    ).toContain("once browser geolocation produces a usable current position");
  });

  it("describes holding the last known fix when follow remains enabled", () => {
    expect(
      getNavigationFollowModeHelperCopy({
        hasFreshPosition: false,
        hasLowConfidencePosition: false,
        hasTrackedPosition: true,
        mode: "follow_position",
      }),
    ).toContain("last known GPS fix");
  });

  it("describes approximate follow guidance when the live fix is low confidence", () => {
    expect(
      getNavigationFollowModeHelperCopy({
        hasFreshPosition: false,
        hasLowConfidencePosition: true,
        hasTrackedPosition: true,
        mode: "follow_position",
      }),
    ).toContain("low-confidence live GPS fix");
  });
});

describe("getNavigationFollowModeActionLabel", () => {
  it("does not render a follow action while auto-follow is already active", () => {
    expect(
      getNavigationFollowModeActionLabel({
        hasTrackedPosition: true,
        mode: "follow_position",
      }),
    ).toBeNull();
  });

  it("offers an explicit recenter action when manual pan still has a tracked fix", () => {
    expect(
      getNavigationFollowModeActionLabel({
        hasTrackedPosition: true,
        mode: "manual_pan",
      }),
    ).toBe("Recenter map");
  });

  it("offers to re-enable follow even before a new fix is ready", () => {
    expect(
      getNavigationFollowModeActionLabel({
        hasTrackedPosition: false,
        mode: "manual_pan",
      }),
    ).toBe("Re-enable follow");
  });
});
