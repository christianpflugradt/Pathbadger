import type { BrowserGeolocationPosition } from "./browser-geolocation";
import type { NavigationFollowMode } from "./navigation-follow-state";
import type { NavigationRuntimeMode } from "./navigation-runtime-mode";

export type NavigationOrientationMode = "north_up" | "heading_up";

export type NavigationOrientationModeOption = {
  detail: string;
  label: string;
  mode: NavigationOrientationMode;
};

export const MIN_HEADING_SPEED_MPS = 1;

const navigationOrientationModeOptions: NavigationOrientationModeOption[] = [
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
];

export function getNavigationOrientationModeOptions() {
  return navigationOrientationModeOptions;
}

export function getNavigationOrientationState(options: {
  followMode: NavigationFollowMode;
  hasFreshPosition: boolean;
  hasLowConfidencePosition: boolean;
  hasTrackedPosition: boolean;
  isNavigationActive: boolean;
  mode: NavigationOrientationMode;
  position: BrowserGeolocationPosition | null;
  runtimeMode: NavigationRuntimeMode;
}) {
  const normalizedHeadingDegrees = normalizeHeadingDegrees(
    options.position?.headingDegrees ?? null,
  );
  const speedMetersPerSecond = options.position?.speedMetersPerSecond ?? null;
  const isHeadingUpRequested = options.mode === "heading_up";
  const isBatterySaver = options.runtimeMode === "battery_saver";
  const isHeadingUpActive =
    isHeadingUpRequested &&
    !isBatterySaver &&
    options.followMode === "follow_position" &&
    options.hasTrackedPosition &&
    options.hasFreshPosition &&
    !options.hasLowConfidencePosition &&
    normalizedHeadingDegrees !== null &&
    speedMetersPerSecond !== null &&
    speedMetersPerSecond >= MIN_HEADING_SPEED_MPS;

  return {
    appliedBearingDegrees: isHeadingUpActive ? normalizedHeadingDegrees : 0,
    helperCopy: getNavigationOrientationHelperCopy({
      followMode: options.followMode,
      hasFreshPosition: options.hasFreshPosition,
      hasLowConfidencePosition: options.hasLowConfidencePosition,
      hasTrackedPosition: options.hasTrackedPosition,
      isBatterySaver,
      isHeadingUpActive,
      isNavigationActive: options.isNavigationActive,
      normalizedHeadingDegrees,
      speedMetersPerSecond,
    }),
    indicatorLabel: isHeadingUpActive
      ? `Heading up ${formatHeadingCue(normalizedHeadingDegrees)}`
      : isHeadingUpRequested
        ? "North up fallback"
        : "North up",
    isHeadingUpActive,
    statusLabel: isHeadingUpActive
      ? `Heading up ${formatHeadingCue(normalizedHeadingDegrees)}`
      : isHeadingUpRequested
        ? "Heading-up pending"
        : "North up",
    statusPillClassName:
      isHeadingUpRequested && !isHeadingUpActive
        ? "status-pill--warning"
        : "status-pill--active",
  };
}

function getNavigationOrientationHelperCopy(options: {
  followMode: NavigationFollowMode;
  hasFreshPosition: boolean;
  hasLowConfidencePosition: boolean;
  hasTrackedPosition: boolean;
  isBatterySaver: boolean;
  isHeadingUpActive: boolean;
  isNavigationActive: boolean;
  normalizedHeadingDegrees: number | null;
  speedMetersPerSecond: number | null;
}) {
  if (options.isHeadingUpActive) {
    return `Heading-up is active. Pathbadger is rotating the map around the live ${formatHeadingCue(options.normalizedHeadingDegrees)} heading while keeping north explicit in the orientation status.`;
  }

  if (options.isBatterySaver) {
    return "Heading-up is unavailable while Battery saver is selected. Pathbadger keeps the map north-up so reduced-GPS mode does not pretend it has reliable live orientation.";
  }

  if (options.followMode === "manual_pan") {
    return "Heading-up is paused while manual map view is active. Recenter the map to let Pathbadger rotate around the live heading again.";
  }

  if (!options.isNavigationActive) {
    return "Heading-up is armed. Once navigation starts, Pathbadger will rotate the map only after the browser reports a fresh current position and heading.";
  }

  if (!options.hasTrackedPosition) {
    return "Heading-up is waiting for browser geolocation. The map will rotate once a usable current position and heading arrive.";
  }

  if (options.hasLowConfidencePosition || !options.hasFreshPosition) {
    return "Heading-up waits for a fresh high-confidence GPS fix before rotating the map.";
  }

  if (options.normalizedHeadingDegrees === null) {
    return "The browser is not exposing a usable heading sample yet, so Pathbadger is keeping the map north-up.";
  }

  if (
    options.speedMetersPerSecond === null ||
    options.speedMetersPerSecond < MIN_HEADING_SPEED_MPS
  ) {
    return `Heading-up waits until the browser reports at least ${MIN_HEADING_SPEED_MPS.toFixed(0)} m/s of movement before trusting the live heading sample.`;
  }

  return "Pathbadger is keeping the map north-up.";
}

function normalizeHeadingDegrees(headingDegrees: number | null) {
  if (typeof headingDegrees !== "number" || !Number.isFinite(headingDegrees)) {
    return null;
  }

  return ((headingDegrees % 360) + 360) % 360;
}

function formatHeadingCue(headingDegrees: number | null) {
  if (headingDegrees === null) {
    return "unknown";
  }

  const roundedDegrees = Math.round(headingDegrees);
  const cardinalDirections = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const cardinalDirection =
    cardinalDirections[Math.round(roundedDegrees / 45) % 8];

  return `${roundedDegrees}° ${cardinalDirection}`;
}
