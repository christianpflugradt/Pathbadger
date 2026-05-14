import { describe, expect, it } from "vitest";

import { DEFAULT_BROWSER_GEOLOCATION_OPTIONS } from "./browser-geolocation.js";
import {
  BATTERY_SAVER_BROWSER_GEOLOCATION_OPTIONS,
  getNavigationRuntimeModeLabel,
  getNavigationRuntimeModeOptions,
  getNavigationRuntimeModePositionOptions,
  getNavigationRuntimeModeSummary,
} from "./navigation-runtime-mode.js";

describe("navigation runtime mode", () => {
  it("surfaces the supported runtime mode options and their tradeoffs", () => {
    expect(getNavigationRuntimeModeOptions()).toEqual([
      {
        mode: "normal",
        label: "Normal GPS",
        detail:
          "Favors fresher, higher-accuracy fixes so progress, speed, and off-route cues can tighten sooner.",
      },
      {
        mode: "battery_saver",
        label: "Battery saver",
        detail:
          "Reduces browser GPS urgency and tolerates older cached fixes, which can leave guidance approximate for longer.",
      },
    ]);
  });

  it("keeps normal mode aligned with the default high-accuracy browser watch", () => {
    expect(getNavigationRuntimeModePositionOptions("normal")).toEqual(
      DEFAULT_BROWSER_GEOLOCATION_OPTIONS,
    );
  });

  it("relaxes the browser watch when battery saver is enabled", () => {
    expect(getNavigationRuntimeModePositionOptions("battery_saver")).toEqual(
      BATTERY_SAVER_BROWSER_GEOLOCATION_OPTIONS,
    );
  });

  it("describes the active battery-saver tradeoff honestly", () => {
    expect(
      getNavigationRuntimeModeSummary({
        isNavigationActive: true,
        mode: "battery_saver",
      }),
    ).toContain("cached fixes up to 60 s old");
    expect(
      getNavigationRuntimeModeSummary({
        isNavigationActive: true,
        mode: "battery_saver",
      }),
    ).toContain("approximate for longer");
  });

  it("labels the current runtime mode for navigation stats", () => {
    expect(getNavigationRuntimeModeLabel("normal")).toBe("Normal GPS");
    expect(getNavigationRuntimeModeLabel("battery_saver")).toBe(
      "Battery saver",
    );
  });
});
