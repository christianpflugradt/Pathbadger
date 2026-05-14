import type { BrowserGeolocationState } from "./browser-geolocation";

type NavigationTrackingStateOptions = {
  browserGeolocation: BrowserGeolocationState;
  hasFreshPosition: boolean;
  hasLowConfidencePosition: boolean;
  hasTrackedPosition: boolean;
  lowConfidenceCopy?: string | null;
};

export function getNavigationTrackingPanelCopy(
  options: NavigationTrackingStateOptions,
) {
  if (options.hasFreshPosition) {
    return "This execution shell is now following the route from live browser geolocation while keeping progress, remaining distance, and off-route checks fully local in the frontend.";
  }

  if (options.hasLowConfidencePosition) {
    return "This execution shell is following the route from live browser geolocation, but the current fix is low confidence, so Pathbadger is keeping progress and off-route cues conservative until a tighter browser update arrives.";
  }

  if (options.hasTrackedPosition) {
    switch (options.browserGeolocation.status) {
      case "denied":
        return "This execution shell is holding the last known real browser GPS fix because browser location permission is now denied. Progress stays local, but live current-position updates are blocked until permission is restored.";
      case "unsupported":
        return "This execution shell is holding the last known real browser GPS fix, but this browser no longer exposes geolocation for live updates. Progress stays local until a supported browser can resume the feed.";
      case "unavailable":
        return "This execution shell is holding the last known real browser GPS fix while the live browser geolocation feed is unavailable. Progress stays local until a usable GPS update returns.";
      case "requesting":
      case "idle":
      case "ready":
      default:
        return "This execution shell is holding the last known browser GPS fix while it waits for a fresh browser geolocation update.";
    }
  }

  return "This navigation session is active, but it is waiting for a usable browser GPS fix before current-position metrics can begin.";
}

export function getNavigationTrackingStatusLabel(
  options: NavigationTrackingStateOptions,
) {
  if (options.hasFreshPosition) {
    return "Live GPS feed";
  }

  if (options.hasLowConfidencePosition) {
    return "Low-confidence GPS";
  }

  if (options.hasTrackedPosition) {
    switch (options.browserGeolocation.status) {
      case "denied":
        return "GPS feed blocked";
      case "unsupported":
        return "GPS unsupported";
      case "unavailable":
        return "GPS signal lost";
      case "requesting":
      case "idle":
      case "ready":
      default:
        return "Last GPS fix held";
    }
  }

  switch (options.browserGeolocation.status) {
    case "requesting":
      return "Waiting for GPS";
    case "denied":
      return "Permission denied";
    case "unsupported":
      return "Geolocation unsupported";
    case "unavailable":
      return "GPS unavailable";
    case "idle":
    case "ready":
    default:
      return "GPS pending";
  }
}

export function getNavigationTrackingStatusPillClassName(
  options: NavigationTrackingStateOptions,
) {
  if (options.hasFreshPosition) {
    return "status-pill--active";
  }

  if (options.hasLowConfidencePosition) {
    return "status-pill--warning";
  }

  if (
    options.hasTrackedPosition &&
    hasBlockingBrowserGeolocationStatus(options.browserGeolocation.status)
  ) {
    return "status-pill--error";
  }

  if (
    options.hasTrackedPosition ||
    options.browserGeolocation.status === "requesting"
  ) {
    return "status-pill--warning";
  }

  if (hasBlockingBrowserGeolocationStatus(options.browserGeolocation.status)) {
    return "status-pill--error";
  }

  return "status-pill--warning";
}

export function getNavigationTrackingBannerClassName(
  options: NavigationTrackingStateOptions,
) {
  if (options.hasFreshPosition) {
    return "";
  }

  if (options.hasLowConfidencePosition) {
    return " response-banner--pending";
  }

  if (
    options.hasTrackedPosition &&
    hasBlockingBrowserGeolocationStatus(options.browserGeolocation.status)
  ) {
    return " response-banner--error";
  }

  if (
    options.hasTrackedPosition ||
    options.browserGeolocation.status === "requesting"
  ) {
    return " response-banner--pending";
  }

  if (hasBlockingBrowserGeolocationStatus(options.browserGeolocation.status)) {
    return " response-banner--error";
  }

  return " response-banner--pending";
}

export function getNavigationTrackingBannerTitle(
  options: NavigationTrackingStateOptions,
) {
  if (options.hasFreshPosition) {
    return "Live browser geolocation active";
  }

  if (options.hasLowConfidencePosition) {
    return "Low-confidence GPS fix";
  }

  if (options.hasTrackedPosition) {
    switch (options.browserGeolocation.status) {
      case "denied":
        return "Live GPS permission lost";
      case "unsupported":
        return "Live GPS unsupported";
      case "unavailable":
        return "Live GPS fix unavailable";
      case "requesting":
      case "idle":
      case "ready":
      default:
        return "Holding the last known GPS fix";
    }
  }

  switch (options.browserGeolocation.status) {
    case "denied":
      return "Browser location permission denied";
    case "unsupported":
      return "Browser geolocation unavailable";
    case "unavailable":
      return "No usable GPS fix yet";
    case "requesting":
      return "Waiting for browser GPS";
    case "idle":
    case "ready":
    default:
      return "Preparing browser geolocation";
  }
}

export function getNavigationTrackingBannerCopy(
  options: NavigationTrackingStateOptions,
) {
  if (options.hasFreshPosition) {
    return "The current-position marker and navigation metrics are updating from the browser GPS feed without backend polling.";
  }

  if (options.hasLowConfidencePosition) {
    return (
      options.lowConfidenceCopy ??
      "Pathbadger is using the live browser GPS fix cautiously because it is too noisy for precise progress or off-route reactions."
    );
  }

  if (options.hasTrackedPosition) {
    switch (options.browserGeolocation.status) {
      case "denied":
        return options.browserGeolocation.message
          ? `Pathbadger is retaining the last real GPS fix, but live geolocation is blocked. ${options.browserGeolocation.message}`
          : "Pathbadger is retaining the last real GPS fix, but live geolocation is blocked until browser location permission is restored.";
      case "unsupported":
        return options.browserGeolocation.message
          ? `Pathbadger is retaining the last real GPS fix, but live geolocation is unsupported. ${options.browserGeolocation.message}`
          : "Pathbadger is retaining the last real GPS fix, but this browser cannot resume live geolocation updates.";
      case "unavailable":
        return options.browserGeolocation.message
          ? `Pathbadger is retaining the last real GPS fix while the live geolocation feed is unavailable. ${options.browserGeolocation.message}`
          : "Pathbadger is retaining the last real GPS fix while it waits for a usable browser GPS update.";
      case "requesting":
      case "idle":
      case "ready":
      default:
        return options.browserGeolocation.message
          ? `Pathbadger is retaining the last real GPS fix while it waits for a fresh update. ${options.browserGeolocation.message}`
          : "Pathbadger is retaining the last real GPS fix while it waits for a fresh update.";
    }
  }

  switch (options.browserGeolocation.status) {
    case "requesting":
      return "Navigation is waiting for browser permission and a usable GPS fix before it can render a current-position marker.";
    case "denied":
      return "Navigation is paused because browser location permission is denied. Re-enable permission or stop the session.";
    case "unsupported":
      return "Navigation is blocked because this browser does not expose geolocation.";
    case "unavailable":
      return (
        options.browserGeolocation.message ??
        "Navigation is waiting for a usable browser GPS fix."
      );
    case "idle":
    case "ready":
    default:
      return "Navigation is preparing to request browser geolocation.";
  }
}

function hasBlockingBrowserGeolocationStatus(
  status: BrowserGeolocationState["status"],
) {
  return (
    status === "denied" || status === "unsupported" || status === "unavailable"
  );
}
