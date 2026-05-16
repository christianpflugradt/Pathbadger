export type NavigationMapCameraState = {
  padding: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  pitchDegrees: number;
  transitionDurationMs: number;
  zoomLevel: number;
};

export function getNavigationMapCameraState(options: {
  currentSpeedKmh: number | null;
  hasFreshPosition: boolean;
  isHeadingUpActive: boolean;
  isOffRoute: boolean;
  viewportHeight: number;
  viewportWidth: number;
}): NavigationMapCameraState {
  const viewportWidth = Math.max(options.viewportWidth, 320);
  const viewportHeight = Math.max(options.viewportHeight, 480);
  const speedKmh = options.currentSpeedKmh ?? 0;
  const sidePadding = clamp(Math.round(viewportWidth * 0.08), 28, 76);
  const topPadding = options.isOffRoute
    ? clamp(Math.round(viewportHeight * 0.24), 120, 220)
    : clamp(Math.round(viewportHeight * 0.36), 150, 300);
  const bottomPadding = clamp(Math.round(viewportHeight * 0.12), 56, 110);

  let zoomLevel = 16.2;

  if (options.isOffRoute) {
    zoomLevel = 15.15;
  } else if (speedKmh >= 24) {
    zoomLevel = 14.95;
  } else if (speedKmh >= 16) {
    zoomLevel = 15.25;
  } else if (speedKmh >= 10) {
    zoomLevel = 15.55;
  } else if (speedKmh >= 6) {
    zoomLevel = 15.85;
  }

  if (!options.hasFreshPosition) {
    zoomLevel = Math.min(zoomLevel, 15.6);
  }

  return {
    padding: {
      bottom: bottomPadding,
      left: sidePadding,
      right: sidePadding,
      top: topPadding,
    },
    pitchDegrees: options.isOffRoute ? 42 : options.isHeadingUpActive ? 58 : 50,
    transitionDurationMs: options.hasFreshPosition ? 450 : 250,
    zoomLevel,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
