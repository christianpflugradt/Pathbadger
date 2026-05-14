import { describe, expect, it } from "vitest";

import {
  getNavigationGpsConfidenceState,
  getNavigationGpsGuardrailPreviewCopy,
} from "./navigation-gps-confidence.js";

describe("navigation GPS confidence", () => {
  it("treats recent accurate live fixes as high confidence", () => {
    expect(
      getNavigationGpsConfidenceState({
        browserGeolocation: {
          errorCode: null,
          message: "Using the latest browser GPS fix.",
          position: {
            accuracyMeters: 8,
            coordinate: { lat: 54.33, lon: 10.12 },
            headingDegrees: null,
            speedMetersPerSecond: 4.5,
            timestampMs: 20_000,
          },
          status: "ready",
        },
        nowMs: 30_000,
      }),
    ).toEqual({
      accuracyMeters: 8,
      ageMs: 10_000,
      hasHighConfidencePosition: true,
      hasLowConfidencePosition: false,
      isAccuracyBroad: false,
      isStale: false,
      lowConfidenceCopy: null,
    });
  });

  it("downgrades broad-accuracy live fixes to low confidence", () => {
    const state = getNavigationGpsConfidenceState({
      browserGeolocation: {
        errorCode: null,
        message: "Using the latest browser GPS fix.",
        position: {
          accuracyMeters: 62,
          coordinate: { lat: 54.33, lon: 10.12 },
          headingDegrees: null,
          speedMetersPerSecond: 4.5,
          timestampMs: 20_000,
        },
        status: "ready",
      },
      nowMs: 25_000,
    });

    expect(state.hasHighConfidencePosition).toBe(false);
    expect(state.hasLowConfidencePosition).toBe(true);
    expect(state.lowConfidenceCopy).toContain("+/-62 m");
    expect(state.lowConfidenceCopy).toContain(
      "Progress and off-route cues stay approximate",
    );
  });

  it("downgrades stale live fixes to low confidence", () => {
    const state = getNavigationGpsConfidenceState({
      browserGeolocation: {
        errorCode: null,
        message: "Using the latest browser GPS fix.",
        position: {
          accuracyMeters: 9,
          coordinate: { lat: 54.33, lon: 10.12 },
          headingDegrees: null,
          speedMetersPerSecond: 4.5,
          timestampMs: 10_000,
        },
        status: "ready",
      },
      nowMs: 31_000,
    });

    expect(state.hasHighConfidencePosition).toBe(false);
    expect(state.hasLowConfidencePosition).toBe(true);
    expect(state.lowConfidenceCopy).toContain("21 s old");
  });

  it("surfaces an always-visible preview summary for the guardrail behavior", () => {
    expect(getNavigationGpsGuardrailPreviewCopy()).toContain(
      "Low-confidence or stale live GPS fixes stay conservative",
    );
    expect(getNavigationGpsGuardrailPreviewCopy()).toContain("approximate");
  });
});
