import { useEffect, useState } from "react";
import type { Coordinate } from "@pathbadger/shared";

const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;

export const DEFAULT_BROWSER_GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 20_000,
} satisfies PositionOptions;

export type BrowserGeolocationApi = Pick<
  Geolocation,
  "clearWatch" | "getCurrentPosition" | "watchPosition"
>;

export type BrowserGeolocationStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "unsupported"
  | "denied"
  | "unavailable";

export type BrowserGeolocationErrorCode =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unsupported";

export type BrowserGeolocationPosition = {
  accuracyMeters: number | null;
  coordinate: Coordinate;
  headingDegrees: number | null;
  speedMetersPerSecond: number | null;
  timestampMs: number;
};

export type BrowserGeolocationState = {
  errorCode: BrowserGeolocationErrorCode | null;
  message: string | null;
  position: BrowserGeolocationPosition | null;
  status: BrowserGeolocationStatus;
};

type BrowserGeolocationErrorShape = Pick<
  GeolocationPositionError,
  "code" | "message"
>;

function createIdleBrowserGeolocationState(): BrowserGeolocationState {
  return {
    errorCode: null,
    message: null,
    position: null,
    status: "idle",
  };
}

function createUnsupportedBrowserGeolocationState(): BrowserGeolocationState {
  return {
    errorCode: "unsupported",
    message: "This browser does not expose geolocation.",
    position: null,
    status: "unsupported",
  };
}

function createRequestingBrowserGeolocationState(
  lastKnownPosition: BrowserGeolocationPosition | null,
): BrowserGeolocationState {
  return {
    errorCode: null,
    message: "Waiting for browser permission and a usable GPS fix.",
    position: lastKnownPosition,
    status: "requesting",
  };
}

function createReadyBrowserGeolocationState(
  position: BrowserGeolocationPosition,
): BrowserGeolocationState {
  return {
    errorCode: null,
    message: "Using the latest browser GPS fix.",
    position,
    status: "ready",
  };
}

function createBrowserGeolocationErrorState(
  error: BrowserGeolocationErrorShape,
  lastKnownPosition: BrowserGeolocationPosition | null,
): BrowserGeolocationState {
  const normalizedError = normalizeBrowserGeolocationError(error);

  return {
    errorCode: normalizedError.errorCode,
    message: normalizedError.message,
    position: lastKnownPosition,
    status: normalizedError.status,
  };
}

export function normalizeBrowserGeolocationPosition(
  position: Pick<GeolocationPosition, "coords" | "timestamp">,
): BrowserGeolocationPosition {
  return {
    accuracyMeters: normalizeOptionalNumber(position.coords.accuracy),
    coordinate: {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    },
    headingDegrees: normalizeOptionalNumber(position.coords.heading),
    speedMetersPerSecond: normalizeOptionalNumber(position.coords.speed),
    timestampMs: position.timestamp,
  };
}

export function normalizeBrowserGeolocationError(
  error: BrowserGeolocationErrorShape,
): Pick<BrowserGeolocationState, "errorCode" | "message" | "status"> {
  switch (error.code) {
    case GEOLOCATION_PERMISSION_DENIED:
      return {
        errorCode: "permission_denied",
        message:
          error.message ||
          "Location permission was denied in the browser settings.",
        status: "denied",
      };
    case GEOLOCATION_TIMEOUT:
      return {
        errorCode: "timeout",
        message:
          error.message ||
          "Browser geolocation timed out before a usable fix was available.",
        status: "unavailable",
      };
    case GEOLOCATION_POSITION_UNAVAILABLE:
    default:
      return {
        errorCode: "position_unavailable",
        message:
          error.message ||
          "Browser geolocation could not determine a usable current position.",
        status: "unavailable",
      };
  }
}

export function subscribeToBrowserGeolocation(options: {
  geolocation?: BrowserGeolocationApi | null;
  onChange: (state: BrowserGeolocationState) => void;
  positionOptions?: PositionOptions;
}) {
  if (!options.geolocation) {
    options.onChange(createUnsupportedBrowserGeolocationState());
    return () => {};
  }

  let lastKnownPosition: BrowserGeolocationPosition | null = null;

  options.onChange(createRequestingBrowserGeolocationState(lastKnownPosition));

  let watchId: number;

  try {
    watchId = options.geolocation.watchPosition(
      (position) => {
        lastKnownPosition = normalizeBrowserGeolocationPosition(position);
        options.onChange(createReadyBrowserGeolocationState(lastKnownPosition));
      },
      (error) => {
        options.onChange(
          createBrowserGeolocationErrorState(error, lastKnownPosition),
        );
      },
      options.positionOptions,
    );
  } catch (error) {
    options.onChange({
      errorCode: "position_unavailable",
      message:
        error instanceof Error
          ? error.message
          : "Browser geolocation could not start.",
      position: lastKnownPosition,
      status: "unavailable",
    });

    return () => {};
  }

  return () => {
    options.geolocation?.clearWatch(watchId);
  };
}

export function requestSingleBrowserGeolocationFix(options?: {
  geolocation?: BrowserGeolocationApi | null;
  positionOptions?: PositionOptions;
}) {
  const geolocation = options?.geolocation ?? getBrowserGeolocationApi();
  const positionOptions =
    options?.positionOptions ?? DEFAULT_BROWSER_GEOLOCATION_OPTIONS;

  if (!geolocation?.getCurrentPosition) {
    return Promise.resolve(createUnsupportedBrowserGeolocationState());
  }

  return new Promise<BrowserGeolocationState>((resolve) => {
    try {
      geolocation.getCurrentPosition(
        (position) => {
          resolve(
            createReadyBrowserGeolocationState(
              normalizeBrowserGeolocationPosition(position),
            ),
          );
        },
        (error) => {
          resolve(createBrowserGeolocationErrorState(error, null));
        },
        positionOptions,
      );
    } catch (error) {
      resolve({
        errorCode: "position_unavailable",
        message:
          error instanceof Error
            ? error.message
            : "Browser geolocation could not start.",
        position: null,
        status: "unavailable",
      });
    }
  });
}

export function useBrowserGeolocation(options?: {
  enabled?: boolean;
  geolocation?: BrowserGeolocationApi | null;
  positionOptions?: PositionOptions;
}) {
  const enabled = options?.enabled ?? true;
  const geolocation = options?.geolocation ?? getBrowserGeolocationApi();
  const positionOptions =
    options?.positionOptions ?? DEFAULT_BROWSER_GEOLOCATION_OPTIONS;
  const [state, setState] = useState<BrowserGeolocationState>(() =>
    enabled
      ? geolocation
        ? createRequestingBrowserGeolocationState(null)
        : createUnsupportedBrowserGeolocationState()
      : createIdleBrowserGeolocationState(),
  );

  useEffect(() => {
    if (!enabled) {
      setState(createIdleBrowserGeolocationState());
      return;
    }

    return subscribeToBrowserGeolocation({
      geolocation,
      onChange: setState,
      positionOptions,
    });
  }, [
    enabled,
    geolocation,
    positionOptions.enableHighAccuracy,
    positionOptions.maximumAge,
    positionOptions.timeout,
  ]);

  return state;
}

function getBrowserGeolocationApi() {
  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator.geolocation ?? null;
}

function normalizeOptionalNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
