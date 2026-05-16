import { describe, expect, it } from "vitest";

import { getNavigationMapCameraState } from "./navigation-map-camera.js";

describe("navigation map camera", () => {
  it("uses a pitched lower-third follow camera by default", () => {
    expect(
      getNavigationMapCameraState({
        currentSpeedKmh: null,
        hasFreshPosition: false,
        isHeadingUpActive: false,
        isOffRoute: false,
        viewportHeight: 900,
        viewportWidth: 420,
      }),
    ).toEqual({
      padding: {
        bottom: 108,
        left: 34,
        right: 34,
        top: 300,
      },
      pitchDegrees: 50,
      transitionDurationMs: 250,
      zoomLevel: 15.6,
    });
  });

  it("pulls back and tilts harder once heading-up is active", () => {
    expect(
      getNavigationMapCameraState({
        currentSpeedKmh: 18,
        hasFreshPosition: true,
        isHeadingUpActive: true,
        isOffRoute: false,
        viewportHeight: 820,
        viewportWidth: 390,
      }),
    ).toEqual({
      padding: {
        bottom: 98,
        left: 31,
        right: 31,
        top: 295,
      },
      pitchDegrees: 58,
      transitionDurationMs: 450,
      zoomLevel: 15.25,
    });
  });

  it("widens the forward view when the session is off route", () => {
    expect(
      getNavigationMapCameraState({
        currentSpeedKmh: 12,
        hasFreshPosition: true,
        isHeadingUpActive: true,
        isOffRoute: true,
        viewportHeight: 780,
        viewportWidth: 360,
      }),
    ).toEqual({
      padding: {
        bottom: 94,
        left: 29,
        right: 29,
        top: 187,
      },
      pitchDegrees: 42,
      transitionDurationMs: 450,
      zoomLevel: 15.15,
    });
  });
});
