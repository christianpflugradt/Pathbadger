import type { Coordinate } from "@pathbadger/shared";

export function getRememberedDefaultOptionDetail(options: {
  savedDefaultStart: Coordinate | null;
  storageAvailable: boolean;
}) {
  if (options.savedDefaultStart) {
    return `Saved in this browser at ${formatCoordinate(options.savedDefaultStart)}.`;
  }

  if (!options.storageAvailable) {
    return "Unavailable because browser local storage is unavailable in this browser.";
  }

  return "Unavailable until you save a remembered default locally.";
}

export function getRememberedDefaultHelperCopy(options: {
  canSaveRememberedDefault: boolean;
  currentStart: Coordinate;
  savedDefaultStart: Coordinate | null;
  storageAvailable: boolean;
}) {
  if (!options.canSaveRememberedDefault) {
    return "Current GPS position is intentionally not saved as the remembered default. Choose a local start first.";
  }

  if (!options.savedDefaultStart) {
    if (!options.storageAvailable) {
      return "Browser local storage is unavailable, so no remembered default can be saved in this browser.";
    }

    return "No remembered default is saved in this browser yet. Save the current non-GPS start to enable that mode.";
  }

  if (areCoordinatesEqual(options.currentStart, options.savedDefaultStart)) {
    return `Remembered default is saved in this browser at ${formatCoordinate(
      options.savedDefaultStart,
    )}.`;
  }

  return `Remembered default is saved at ${formatCoordinate(
    options.savedDefaultStart,
  )}. Save the current start to replace it.`;
}

export function getLastUsedStartOptionDetail(options: {
  lastUsedStart: Coordinate | null;
  storageAvailable: boolean;
}) {
  if (options.lastUsedStart) {
    return `Saved in this browser at ${formatCoordinate(options.lastUsedStart)}.`;
  }

  if (!options.storageAvailable) {
    return "Unavailable because browser local storage is unavailable in this browser.";
  }

  return "Unavailable until a non-GPS start has been used for route generation in this browser.";
}

function areCoordinatesEqual(left: Coordinate, right: Coordinate) {
  return left.lat === right.lat && left.lon === right.lon;
}

function formatCoordinate(coordinate: Coordinate) {
  return `${coordinate.lat.toFixed(4)}, ${coordinate.lon.toFixed(4)}`;
}
