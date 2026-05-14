import { describe, expect, it, vi } from "vitest";

import type {
  BrowserGeolocationApi,
  BrowserGeolocationState,
} from "./browser-geolocation.js";
import {
  DEFAULT_BROWSER_GEOLOCATION_OPTIONS,
  normalizeBrowserGeolocationPosition,
  subscribeToBrowserGeolocation,
} from "./browser-geolocation.js";

type WatchSuccessCallback = (position: GeolocationPosition) => void;
type WatchErrorCallback = (error: GeolocationPositionError) => void;

describe("normalizeBrowserGeolocationPosition", () => {
  it("maps browser coordinates into the shared planner shape", () => {
    expect(
      normalizeBrowserGeolocationPosition({
        coords: {
          accuracy: 8.6,
          heading: Number.NaN,
          latitude: 54.3229,
          longitude: 10.1357,
          speed: 4.9,
        } as GeolocationCoordinates,
        timestamp: 1_762_744_800_000,
      }),
    ).toEqual({
      accuracyMeters: 8.6,
      coordinate: {
        lat: 54.3229,
        lon: 10.1357,
      },
      headingDegrees: null,
      speedMetersPerSecond: 4.9,
      timestampMs: 1_762_744_800_000,
    });
  });
});

describe("subscribeToBrowserGeolocation", () => {
  it("surfaces an honest unsupported state when the browser API is missing", () => {
    const updates: BrowserGeolocationState[] = [];
    const stop = subscribeToBrowserGeolocation({
      geolocation: null,
      onChange: (state) => updates.push(state),
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      errorCode: "unsupported",
      status: "unsupported",
    });
    stop();
  });

  it("normalizes ready updates from watchPosition callbacks", () => {
    let successCallback: WatchSuccessCallback | null = null;
    const geolocation: BrowserGeolocationApi = {
      clearWatch: vi.fn(),
      watchPosition: vi.fn((success) => {
        successCallback = success;
        return 41;
      }),
    };
    const updates: BrowserGeolocationState[] = [];
    const stop = subscribeToBrowserGeolocation({
      geolocation,
      onChange: (state) => updates.push(state),
      positionOptions: DEFAULT_BROWSER_GEOLOCATION_OPTIONS,
    });

    expect(geolocation.watchPosition).toHaveBeenCalledOnce();
    expect(updates[0]).toMatchObject({
      message: "Waiting for browser permission and a usable GPS fix.",
      status: "requesting",
    });

    if (!successCallback) {
      throw new Error("Expected geolocation watchPosition to register.");
    }

    (successCallback as WatchSuccessCallback)({
      coords: {
        accuracy: 6.4,
        heading: 91,
        latitude: 54.331,
        longitude: 10.125,
        speed: 3.2,
      } as GeolocationCoordinates,
      timestamp: 1_762_744_900_000,
    } as GeolocationPosition);

    expect(updates[1]).toMatchObject({
      errorCode: null,
      position: {
        accuracyMeters: 6.4,
        coordinate: {
          lat: 54.331,
          lon: 10.125,
        },
        headingDegrees: 91,
        speedMetersPerSecond: 3.2,
        timestampMs: 1_762_744_900_000,
      },
      status: "ready",
    });

    stop();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(41);
  });

  it("passes custom watch options through to the browser geolocation API", () => {
    const geolocation: BrowserGeolocationApi = {
      clearWatch: vi.fn(),
      watchPosition: vi.fn(() => 12),
    };
    const positionOptions = {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 30_000,
    } satisfies PositionOptions;

    subscribeToBrowserGeolocation({
      geolocation,
      onChange: vi.fn(),
      positionOptions,
    });

    expect(geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      positionOptions,
    );
  });

  it("surfaces a denied state from browser permission errors", () => {
    let errorCallback: WatchErrorCallback | null = null;
    const geolocation: BrowserGeolocationApi = {
      clearWatch: vi.fn(),
      watchPosition: vi.fn((_success, error) => {
        errorCallback = error ?? null;
        return 7;
      }),
    };
    const updates: BrowserGeolocationState[] = [];

    subscribeToBrowserGeolocation({
      geolocation,
      onChange: (state) => updates.push(state),
    });

    if (!errorCallback) {
      throw new Error("Expected geolocation watchPosition to register.");
    }

    (errorCallback as WatchErrorCallback)({
      code: 1,
      message: "User denied Geolocation",
    } as GeolocationPositionError);

    expect(updates[0]).toMatchObject({
      status: "requesting",
    });
    expect(updates[1]).toMatchObject({
      errorCode: "permission_denied",
      message: "User denied Geolocation",
      status: "denied",
    });
  });

  it("retains the last real GPS fix when a later update becomes unavailable", () => {
    let successCallback: WatchSuccessCallback | null = null;
    let errorCallback: WatchErrorCallback | null = null;
    const geolocation: BrowserGeolocationApi = {
      clearWatch: vi.fn(),
      watchPosition: vi.fn((success, error) => {
        successCallback = success;
        errorCallback = error ?? null;
        return 13;
      }),
    };
    const updates: BrowserGeolocationState[] = [];

    subscribeToBrowserGeolocation({
      geolocation,
      onChange: (state) => updates.push(state),
    });

    if (!successCallback || !errorCallback) {
      throw new Error("Expected geolocation watchPosition to register.");
    }

    (successCallback as WatchSuccessCallback)({
      coords: {
        accuracy: 5.4,
        heading: null,
        latitude: 54.331,
        longitude: 10.125,
        speed: null,
      } as GeolocationCoordinates,
      timestamp: 1_762_744_900_000,
    } as GeolocationPosition);

    (errorCallback as WatchErrorCallback)({
      code: 2,
      message: "Signal lost",
    } as GeolocationPositionError);

    expect(updates[2]).toMatchObject({
      errorCode: "position_unavailable",
      message: "Signal lost",
      position: {
        accuracyMeters: 5.4,
        coordinate: {
          lat: 54.331,
          lon: 10.125,
        },
        headingDegrees: null,
        speedMetersPerSecond: null,
        timestampMs: 1_762_744_900_000,
      },
      status: "unavailable",
    });
  });
});
