export type NavigationFollowMode = "follow_position" | "manual_pan";

export function getNavigationFollowModeLabel(mode: NavigationFollowMode) {
  return mode === "follow_position" ? "Following position" : "Manual map view";
}

export function getNavigationFollowModeStatusPillClassName(
  mode: NavigationFollowMode,
) {
  return mode === "follow_position"
    ? "status-pill--active"
    : "status-pill--warning";
}

export function getNavigationFollowModeHelperCopy(options: {
  hasFreshPosition: boolean;
  hasTrackedPosition: boolean;
  mode: NavigationFollowMode;
}) {
  if (options.mode === "manual_pan") {
    return "Map follow is paused after a manual pan. Live GPS updates still drive the current-position marker and route metrics until you recenter.";
  }

  if (!options.hasTrackedPosition) {
    return "Follow-position is armed. The map will recenter itself once browser geolocation produces a usable current position.";
  }

  if (options.hasFreshPosition) {
    return "The map is staying centered on the live browser GPS position.";
  }

  return "The map is holding on to the last known GPS fix until the browser provides a fresh current-position update.";
}

export function getNavigationFollowModeActionLabel(options: {
  hasTrackedPosition: boolean;
  mode: NavigationFollowMode;
}) {
  if (options.mode === "follow_position") {
    return null;
  }

  return options.hasTrackedPosition ? "Recenter map" : "Re-enable follow";
}
