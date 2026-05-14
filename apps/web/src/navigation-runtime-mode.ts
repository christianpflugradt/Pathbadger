import { DEFAULT_BROWSER_GEOLOCATION_OPTIONS } from "./browser-geolocation";

export type NavigationRuntimeMode = "normal" | "battery_saver";

export type NavigationRuntimeModeOption = {
  detail: string;
  label: string;
  mode: NavigationRuntimeMode;
};

export const BATTERY_SAVER_BROWSER_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 30_000,
} satisfies PositionOptions;

const navigationRuntimeModeOptions: NavigationRuntimeModeOption[] = [
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
];

export function getNavigationRuntimeModeOptions() {
  return navigationRuntimeModeOptions;
}

export function getNavigationRuntimeModePositionOptions(
  mode: NavigationRuntimeMode,
) {
  return mode === "battery_saver"
    ? BATTERY_SAVER_BROWSER_GEOLOCATION_OPTIONS
    : DEFAULT_BROWSER_GEOLOCATION_OPTIONS;
}

export function getNavigationRuntimeModeSummary(options: {
  isNavigationActive: boolean;
  mode: NavigationRuntimeMode;
}) {
  if (options.mode === "battery_saver") {
    return options.isNavigationActive
      ? "Battery saver is active. Pathbadger is asking the browser for lower-urgency GPS updates with high-accuracy mode off, cached fixes up to 60 s old, and a 30 s timeout. Progress, speed, and off-route cues may stay approximate for longer."
      : "Battery saver will relax browser geolocation once navigation starts: high-accuracy mode off, cached fixes up to 60 s old, and a 30 s timeout before the watch is treated as unavailable.";
  }

  return options.isNavigationActive
    ? "Normal GPS mode is active. Pathbadger is asking the browser for high-accuracy updates with up to 15 s cached age so progress, speed, and off-route cues can tighten as soon as fresher fixes arrive."
    : "Normal GPS mode will request high-accuracy browser updates once navigation starts, using up to 15 s cached age for the supported watch.";
}

export function getNavigationRuntimeModeLabel(mode: NavigationRuntimeMode) {
  return mode === "battery_saver" ? "Battery saver" : "Normal GPS";
}
