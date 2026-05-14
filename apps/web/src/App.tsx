import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_DISTANCE_TOLERANCE_METERS,
  activityOptions,
  surfacePreferenceOptions,
} from "@pathbadger/shared";
import type {
  Activity,
  Coordinate,
  RouteGeometry,
  RouteGenerateRequest,
  RouteGenerateResponse,
  RouteInstruction,
  SurfacePreference,
} from "@pathbadger/shared";

import type { BrowserGeolocationState } from "./browser-geolocation";
import {
  DEFAULT_BROWSER_GEOLOCATION_OPTIONS,
  useBrowserGeolocation,
} from "./browser-geolocation";
import { webRuntimeConfig } from "./config";
import {
  getNavigationFollowModeActionLabel,
  getNavigationFollowModeHelperCopy,
  getNavigationFollowModeLabel,
  getNavigationFollowModeStatusPillClassName,
} from "./navigation-follow-state";
import type { NavigationFollowMode } from "./navigation-follow-state";
import {
  getNavigationGpsConfidenceState,
  getNavigationGpsGuardrailPreviewCopy,
} from "./navigation-gps-confidence";
import {
  getNavigationOrientationModeOptions,
  getNavigationOrientationState,
} from "./navigation-orientation-state";
import type { NavigationOrientationMode } from "./navigation-orientation-state";
import { createNavigationSnapshot } from "./navigation-session";
import {
  getNavigationTrackingBannerClassName,
  getNavigationTrackingBannerCopy,
  getNavigationTrackingBannerTitle,
  getNavigationTrackingPanelCopy,
  getNavigationTrackingStatusLabel,
  getNavigationTrackingStatusPillClassName,
} from "./navigation-tracking-state";
import {
  createNavigationSpeedBaseline,
  formatNavigationSpeedKmh,
  getNavigationSpeedHelperCopy,
  getNavigationSpeedMetrics,
} from "./navigation-speed-state";
import {
  getNavigationRuntimeCaveats,
  getNavigationRuntimeCaveatSummary,
} from "./navigation-runtime-caveats";
import {
  getNavigationRuntimeModeLabel,
  getNavigationRuntimeModeOptions,
  getNavigationRuntimeModePositionOptions,
  getNavigationRuntimeModeSummary,
} from "./navigation-runtime-mode";
import type { NavigationRuntimeMode } from "./navigation-runtime-mode";
import { PlanningMap } from "./PlanningMap";
import {
  getBrowserLocalStorage,
  loadStoredCoordinate,
  loadStoredStringValue,
  saveStoredCoordinate,
  saveStoredStringValue,
} from "./planning-local-storage";
import {
  getLastUsedStartOptionDetail,
  getRememberedDefaultHelperCopy,
  getRememberedDefaultOptionDetail,
} from "./planning-start-point-state";
import {
  getSurfacePreferenceSectionCopy,
  getTargetDistanceSectionCopy,
} from "./planning-section-copy";
import { requestRoutePreview } from "./route-preview-client";
import {
  getRouteSurfaceSummaryCards,
  getRouteSurfaceSummaryMessage,
} from "./route-surface-summary";
import "./styles.css";

type StartPointMode =
  | "current_position"
  | "map_point"
  | "saved_default"
  | "last_used";
type MapInteractionMode = "idle" | "add_pass_through";
type PassThroughPoint = {
  id: string;
  label: string;
  coordinate: Coordinate;
  source: "map";
};
type NavigationSession = {
  instructions: RouteInstruction[];
  routeGeometry: RouteGeometry;
  routeId: string;
  routeStatus: "partial" | "success";
};
type NavigableRoutePreview = RouteGenerateResponse & {
  geometry: RouteGeometry;
  status: "partial" | "success";
};
type StartPointOption = {
  coordinate: Coordinate;
  detail: string;
  disabled?: boolean;
  label: string;
};

const DEFAULT_CURRENT_POSITION_COORDINATE = { lat: 53.9167, lon: 9.8833 };
const DEFAULT_MAP_SELECTED_START_COORDINATE = { lat: 53.9188, lon: 9.8872 };
const startPointCatalog: Record<
  StartPointMode,
  {
    label: string;
    detail: string;
  }
> = {
  current_position: {
    label: "Current GPS position",
    detail: "Fastest option once location permission is granted.",
  },
  map_point: {
    label: "Map-selected point",
    detail: "Live map clicks set the planning start.",
  },
  saved_default: {
    label: "Remembered default",
    detail: "Useful for repeated trailheads or home starts.",
  },
  last_used: {
    label: "Last used start",
    detail: "Reuse the previous origin without clicking the map again.",
  },
};
const activityLabels: Record<Activity, string> = {
  running_walking: "Running / walking",
  cycling: "Cycling",
};
const surfaceLabels: Record<SurfacePreference, string> = {
  trail: "Trail first",
  mixed: "Mixed",
  asphalt: "Asphalt first",
  indifferent: "Indifferent",
};
const routeStatusLabels: Record<RouteGenerateResponse["status"], string> = {
  success: "Preview ready",
  partial: "Preview needs review",
  failed: "Preview unavailable",
};
const ACTIVITY_STORAGE_KEY = "pathbadger.activityPreference";
const SAVED_DEFAULT_START_STORAGE_KEY = "pathbadger.savedDefaultStart";
const LAST_USED_START_STORAGE_KEY = "pathbadger.lastUsedStart";
const SURFACE_PREFERENCE_STORAGE_KEY = "pathbadger.surfacePreference";
const ignoreMapSelection: (coordinate: Coordinate) => void = () => {};

export function App() {
  const browserLocalStorage = getBrowserLocalStorage();
  const isBrowserLocalStorageAvailable = browserLocalStorage !== null;
  const [startPointMode, setStartPointMode] =
    useState<StartPointMode>("map_point");
  const [savedDefaultStart, setSavedDefaultStart] = useState<Coordinate | null>(
    () =>
      loadStoredCoordinate({
        key: SAVED_DEFAULT_START_STORAGE_KEY,
        storage: browserLocalStorage,
      }),
  );
  const [lastUsedStart, setLastUsedStart] = useState<Coordinate | null>(() =>
    loadStoredCoordinate({
      key: LAST_USED_START_STORAGE_KEY,
      storage: browserLocalStorage,
    }),
  );
  const [rememberedDefaultSaveError, setRememberedDefaultSaveError] = useState<
    string | null
  >(null);
  const [mapSelectedStart, setMapSelectedStart] = useState<Coordinate>(
    DEFAULT_MAP_SELECTED_START_COORDINATE,
  );
  const [mapInteractionMode, setMapInteractionMode] =
    useState<MapInteractionMode>("idle");
  const [activity, setActivity] = useState<Activity>(
    () =>
      loadStoredStringValue({
        allowedValues: activityOptions,
        key: ACTIVITY_STORAGE_KEY,
        storage: browserLocalStorage,
      }) ?? "running_walking",
  );
  const [activityPreferenceSaveFailed, setActivityPreferenceSaveFailed] =
    useState(false);
  const [surfacePreference, setSurfacePreference] = useState<SurfacePreference>(
    () =>
      loadStoredStringValue({
        allowedValues: surfacePreferenceOptions,
        key: SURFACE_PREFERENCE_STORAGE_KEY,
        storage: browserLocalStorage,
      }) ?? "trail",
  );
  const [surfacePreferenceSaveFailed, setSurfacePreferenceSaveFailed] =
    useState(false);
  const [targetDistanceKm, setTargetDistanceKm] = useState(12);
  const [passThroughPoints, setPassThroughPoints] = useState<
    PassThroughPoint[]
  >([]);
  const [previewCandidateIndex, setPreviewCandidateIndex] = useState(1);
  const [routePreview, setRoutePreview] =
    useState<RouteGenerateResponse | null>(null);
  const [navigationSession, setNavigationSession] =
    useState<NavigationSession | null>(null);
  const [navigationRuntimeMode, setNavigationRuntimeMode] =
    useState<NavigationRuntimeMode>("normal");
  const [navigationOrientationMode, setNavigationOrientationMode] =
    useState<NavigationOrientationMode>("north_up");
  const [navigationFollowMode, setNavigationFollowMode] =
    useState<NavigationFollowMode>("follow_position");
  const [navigationManualCenter, setNavigationManualCenter] =
    useState<Coordinate | null>(null);
  const [navigationSpeedBaseline, setNavigationSpeedBaseline] = useState<{
    completedDistanceMeters: number;
    timestampMs: number;
  } | null>(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] =
    useState<RouteGenerateRequest | null>(null);
  const [lastSubmittedSeed, setLastSubmittedSeed] = useState<string | null>(
    null,
  );
  const [isRequestingRoutePreview, setIsRequestingRoutePreview] =
    useState(false);
  const [routePreviewRequestError, setRoutePreviewRequestError] = useState<
    string | null
  >(null);
  const latestRoutePreviewRequestIdRef = useRef(0);
  const isNavigationActive = navigationSession !== null;
  const isBrowserGeolocationEnabled =
    startPointMode === "current_position" || isNavigationActive;
  const navigationRuntimeModeOptions = getNavigationRuntimeModeOptions();
  const navigationOrientationModeOptions =
    getNavigationOrientationModeOptions();
  const browserGeolocationPositionOptions = isNavigationActive
    ? getNavigationRuntimeModePositionOptions(navigationRuntimeMode)
    : DEFAULT_BROWSER_GEOLOCATION_OPTIONS;
  const browserGeolocation = useBrowserGeolocation({
    enabled: isBrowserGeolocationEnabled,
    positionOptions: browserGeolocationPositionOptions,
  });
  const navigationRuntimeModeLabel = getNavigationRuntimeModeLabel(
    navigationRuntimeMode,
  );
  const navigationRuntimeModeSummary = getNavigationRuntimeModeSummary({
    isNavigationActive,
    mode: navigationRuntimeMode,
  });
  const rememberedDefaultOptionDetail = getRememberedDefaultOptionDetail({
    savedDefaultStart,
    storageAvailable: isBrowserLocalStorageAvailable,
  });
  const lastUsedStartOptionDetail = getLastUsedStartOptionDetail({
    lastUsedStart,
    storageAvailable: isBrowserLocalStorageAvailable,
  });
  const startPointOptions: Record<StartPointMode, StartPointOption> = {
    ...startPointCatalog,
    current_position: {
      ...startPointCatalog.current_position,
      coordinate:
        browserGeolocation.position?.coordinate ??
        DEFAULT_CURRENT_POSITION_COORDINATE,
      detail: getCurrentPositionOptionDetail(browserGeolocation),
    },
    map_point: {
      ...startPointCatalog.map_point,
      coordinate: mapSelectedStart,
    },
    saved_default: {
      ...startPointCatalog.saved_default,
      coordinate: savedDefaultStart ?? mapSelectedStart,
      detail: rememberedDefaultOptionDetail,
      disabled: savedDefaultStart === null,
    },
    last_used: {
      ...startPointCatalog.last_used,
      coordinate: lastUsedStart ?? mapSelectedStart,
      detail: lastUsedStartOptionDetail,
      disabled: lastUsedStart === null,
    },
  };

  const startPoint =
    startPointMode === "map_point"
      ? {
          ...startPointOptions.map_point,
          detail: "Click the live map to set the route origin.",
        }
      : startPointOptions[startPointMode];
  const canSaveRememberedDefault = startPointMode !== "current_position";
  const rememberedDefaultButtonLabel = savedDefaultStart
    ? "Update remembered default"
    : "Save current start as default";
  const isAwaitingPassThroughPoint = mapInteractionMode === "add_pass_through";
  const isCurrentPositionPendingRouteGeneration =
    startPointMode === "current_position" &&
    browserGeolocation.status !== "ready";
  const planningRequest: RouteGenerateRequest = {
    start: startPoint.coordinate,
    targetDistanceKm,
    activity,
    surfacePreference,
    passThroughPoints: passThroughPoints.map((point) => point.coordinate),
    randomSeed: null,
    toleranceMeters: DEFAULT_DISTANCE_TOLERANCE_METERS,
  };
  const hasRoutePreview = routePreview !== null;
  const submittedRequestSignature = lastSubmittedRequest
    ? serializeComparablePlanningRequest(lastSubmittedRequest)
    : null;
  const currentRequestSignature =
    serializeComparablePlanningRequest(planningRequest);
  const isRoutePreviewStale =
    submittedRequestSignature !== null &&
    submittedRequestSignature !== currentRequestSignature;
  const requestPreviewCode = JSON.stringify(planningRequest, null, 2);
  const responsePreviewCode = routePreview
    ? JSON.stringify(routePreview, null, 2)
    : null;
  const routeSurfaceSummaryCards = getRouteSurfaceSummaryCards(
    routePreview?.summary ?? null,
  );
  const routeSurfaceSummaryMessage = getRouteSurfaceSummaryMessage(
    routePreview?.summary ?? null,
  );
  const navigableRoutePreview = getNavigableRoutePreview(routePreview);
  const navigationTrackedPosition = isNavigationActive
    ? browserGeolocation.position
    : null;
  const navigationGpsConfidence = getNavigationGpsConfidenceState({
    browserGeolocation,
    nowMs: Date.now(),
  });
  const navigationHasFreshPosition =
    navigationGpsConfidence.hasHighConfidencePosition &&
    navigationTrackedPosition !== null;
  const navigationHasLowConfidencePosition =
    navigationGpsConfidence.hasLowConfidencePosition &&
    navigationTrackedPosition !== null;
  const navigationSnapshot =
    navigationSession && navigationTrackedPosition
      ? createNavigationSnapshot(navigationSession.routeGeometry, {
          currentPosition: navigationTrackedPosition.coordinate,
          instructions: navigationSession.instructions,
          requestedProgressFraction: 0,
        })
      : null;
  const navigationHasTrackedPosition = navigationSnapshot !== null;
  const navigationSpeedMetrics =
    navigationTrackedPosition && navigationSnapshot
      ? getNavigationSpeedMetrics({
          baseline: navigationSpeedBaseline,
          hasFreshPosition: navigationHasFreshPosition,
          position: navigationTrackedPosition,
          snapshot: navigationSnapshot,
        })
      : null;
  const navigationSpeedHelperCopy = navigationSpeedMetrics
    ? getNavigationSpeedHelperCopy({
        averageSpeedKmh: navigationSpeedMetrics.averageSpeedKmh,
        baseline: navigationSpeedBaseline,
        currentSpeedKmh: navigationSpeedMetrics.currentSpeedKmh,
        hasFreshPosition: navigationHasFreshPosition,
      })
    : null;
  const navigationTrackingStatusPillClassName =
    getNavigationTrackingStatusPillClassName({
      browserGeolocation,
      hasFreshPosition: navigationHasFreshPosition,
      hasLowConfidencePosition: navigationHasLowConfidencePosition,
      hasTrackedPosition: navigationHasTrackedPosition,
      lowConfidenceCopy: navigationGpsConfidence.lowConfidenceCopy,
    });
  const navigationTrackingStatusLabel = getNavigationTrackingStatusLabel({
    browserGeolocation,
    hasFreshPosition: navigationHasFreshPosition,
    hasLowConfidencePosition: navigationHasLowConfidencePosition,
    hasTrackedPosition: navigationHasTrackedPosition,
    lowConfidenceCopy: navigationGpsConfidence.lowConfidenceCopy,
  });
  const navigationTrackingBannerClassName =
    getNavigationTrackingBannerClassName({
      browserGeolocation,
      hasFreshPosition: navigationHasFreshPosition,
      hasLowConfidencePosition: navigationHasLowConfidencePosition,
      hasTrackedPosition: navigationHasTrackedPosition,
      lowConfidenceCopy: navigationGpsConfidence.lowConfidenceCopy,
    });
  const navigationTrackingBannerTitle = getNavigationTrackingBannerTitle({
    browserGeolocation,
    hasFreshPosition: navigationHasFreshPosition,
    hasLowConfidencePosition: navigationHasLowConfidencePosition,
    hasTrackedPosition: navigationHasTrackedPosition,
    lowConfidenceCopy: navigationGpsConfidence.lowConfidenceCopy,
  });
  const navigationTrackingBannerCopy = getNavigationTrackingBannerCopy({
    browserGeolocation,
    hasFreshPosition: navigationHasFreshPosition,
    hasLowConfidencePosition: navigationHasLowConfidencePosition,
    hasTrackedPosition: navigationHasTrackedPosition,
    lowConfidenceCopy: navigationGpsConfidence.lowConfidenceCopy,
  });
  const isNavigationFollowingPosition =
    navigationFollowMode === "follow_position";
  const navigationFollowStatusLabel =
    getNavigationFollowModeLabel(navigationFollowMode);
  const navigationFollowStatusPillClassName =
    getNavigationFollowModeStatusPillClassName(navigationFollowMode);
  const navigationFollowHelperCopy = getNavigationFollowModeHelperCopy({
    hasFreshPosition: navigationHasFreshPosition,
    hasLowConfidencePosition: navigationHasLowConfidencePosition,
    hasTrackedPosition: navigationHasTrackedPosition,
    mode: navigationFollowMode,
  });
  const navigationFollowActionLabel = getNavigationFollowModeActionLabel({
    hasTrackedPosition: navigationHasTrackedPosition,
    mode: navigationFollowMode,
  });
  const navigationOrientationState = getNavigationOrientationState({
    followMode: navigationFollowMode,
    hasFreshPosition: navigationHasFreshPosition,
    hasLowConfidencePosition: navigationHasLowConfidencePosition,
    hasTrackedPosition: navigationHasTrackedPosition,
    isNavigationActive,
    mode: navigationOrientationMode,
    position: navigationTrackedPosition,
    runtimeMode: navigationRuntimeMode,
  });
  const canStartNavigation =
    navigableRoutePreview !== null &&
    !isRequestingRoutePreview &&
    routePreviewRequestError === null &&
    !isRoutePreviewStale;
  const mapCenter =
    isNavigationActive &&
    !isNavigationFollowingPosition &&
    navigationManualCenter
      ? navigationManualCenter
      : (navigationSnapshot?.currentPosition ?? startPoint.coordinate);
  const mapCenterLabel =
    isNavigationActive &&
    !isNavigationFollowingPosition &&
    navigationManualCenter
      ? "Manual map view"
      : navigationSnapshot
        ? navigationHasFreshPosition
          ? "Live GPS position"
          : "Last known GPS position"
        : startPoint.label;
  const mapRouteGeometry =
    navigationSession?.routeGeometry ?? routePreview?.geometry ?? null;
  const mapRouteStatus =
    navigationSession?.routeStatus ?? routePreview?.status ?? null;
  const currentPositionStatusPillClassName =
    getCurrentPositionStatusPillClassName(browserGeolocation);
  const currentPositionHelperClassName =
    getCurrentPositionHelperClassName(browserGeolocation);
  const rememberedDefaultHelperClassName =
    rememberedDefaultSaveError !== null
      ? "helper-copy--error"
      : canSaveRememberedDefault
        ? savedDefaultStart
          ? "helper-copy--active"
          : "helper-copy--warning"
        : "helper-copy--warning";
  const rememberedDefaultHelperCopy = rememberedDefaultSaveError
    ? rememberedDefaultSaveError
    : getRememberedDefaultHelperCopy({
        canSaveRememberedDefault,
        currentStart: startPoint.coordinate,
        savedDefaultStart,
        storageAvailable: isBrowserLocalStorageAvailable,
      });
  const activityPreferenceHelperClassName =
    getPlanningPreferenceHelperClassName({
      persistenceFailed: activityPreferenceSaveFailed,
      storageAvailable: isBrowserLocalStorageAvailable,
    });
  const activityPreferenceHelperCopy = getPlanningPreferenceHelperCopy({
    name: "Activity preference",
    persistenceFailed: activityPreferenceSaveFailed,
    storageAvailable: isBrowserLocalStorageAvailable,
  });
  const surfacePreferenceHelperClassName = getPlanningPreferenceHelperClassName(
    {
      persistenceFailed: surfacePreferenceSaveFailed,
      storageAvailable: isBrowserLocalStorageAvailable,
    },
  );
  const surfacePreferenceHelperCopy = getPlanningPreferenceHelperCopy({
    name: "Surface preference",
    persistenceFailed: surfacePreferenceSaveFailed,
    storageAvailable: isBrowserLocalStorageAvailable,
  });

  useEffect(() => {
    if (!navigationSession) {
      setNavigationSpeedBaseline(null);
      return;
    }

    if (
      navigationSpeedBaseline ||
      !navigationTrackedPosition ||
      !navigationSnapshot
    ) {
      return;
    }

    setNavigationSpeedBaseline(
      createNavigationSpeedBaseline({
        position: navigationTrackedPosition,
        snapshot: navigationSnapshot,
      }),
    );
  }, [
    navigationSession,
    navigationSpeedBaseline,
    navigationTrackedPosition,
    navigationSnapshot,
  ]);

  useEffect(() => {
    if (startPointMode === "saved_default" && savedDefaultStart === null) {
      setStartPointMode("map_point");
      return;
    }

    if (startPointMode === "last_used" && lastUsedStart === null) {
      setStartPointMode("map_point");
    }
  }, [lastUsedStart, savedDefaultStart, startPointMode]);

  function handleStartPointModeChange(mode: StartPointMode) {
    if (startPointOptions[mode].disabled) {
      return;
    }

    setStartPointMode(mode);

    if (mode === "map_point") {
      setMapInteractionMode("idle");
    }
  }

  function handleMapSelection(coordinate: Coordinate) {
    if (isAwaitingPassThroughPoint) {
      setPassThroughPoints((current) => {
        const nextIndex = current.length + 1;

        return [
          ...current,
          {
            id: `map-waypoint-${nextIndex}`,
            label: `Map waypoint ${nextIndex}`,
            coordinate,
            source: "map",
          },
        ];
      });
      setMapInteractionMode("idle");
      return;
    }

    if (startPointMode === "map_point") {
      setMapSelectedStart(coordinate);
    }
  }

  function togglePassThroughPointSelection() {
    setMapInteractionMode((current) =>
      current === "add_pass_through" ? "idle" : "add_pass_through",
    );
  }

  function handleActivityChange(nextActivity: Activity) {
    setActivity(nextActivity);
    setActivityPreferenceSaveFailed(
      !saveStoredStringValue({
        key: ACTIVITY_STORAGE_KEY,
        storage: browserLocalStorage,
        value: nextActivity,
      }),
    );
  }

  function handleSurfacePreferenceChange(
    nextSurfacePreference: SurfacePreference,
  ) {
    setSurfacePreference(nextSurfacePreference);
    setSurfacePreferenceSaveFailed(
      !saveStoredStringValue({
        key: SURFACE_PREFERENCE_STORAGE_KEY,
        storage: browserLocalStorage,
        value: nextSurfacePreference,
      }),
    );
  }

  function saveCurrentStartAsRememberedDefault() {
    if (!canSaveRememberedDefault) {
      setRememberedDefaultSaveError(
        "Current GPS position is intentionally not saved as the remembered default. Choose a local start first.",
      );
      return;
    }

    const didSave = saveStoredCoordinate({
      coordinate: startPoint.coordinate,
      key: SAVED_DEFAULT_START_STORAGE_KEY,
      storage: browserLocalStorage,
    });

    if (!didSave) {
      setRememberedDefaultSaveError(
        "Browser local storage is unavailable, so the remembered default could not be saved in this browser.",
      );
      return;
    }

    setSavedDefaultStart(startPoint.coordinate);
    setRememberedDefaultSaveError(null);
  }

  function handleNavigationManualPan(center: Coordinate) {
    setNavigationFollowMode("manual_pan");
    setNavigationManualCenter(center);
  }

  function handleNavigationViewportChange(center: Coordinate) {
    setNavigationManualCenter(center);
  }

  function recenterNavigationMap() {
    setNavigationFollowMode("follow_position");
    setNavigationManualCenter(null);
  }

  function removePassThroughPoint(id: string) {
    setPassThroughPoints((current) =>
      current.filter((point) => point.id !== id),
    );
  }

  async function submitRoutePreviewRequest(options: {
    candidateIndex: number;
    randomSeed: string | null;
  }) {
    const nextRequest: RouteGenerateRequest = {
      ...planningRequest,
      randomSeed: options.randomSeed,
    };
    const nextRequestId = latestRoutePreviewRequestIdRef.current + 1;

    if (startPointMode !== "current_position") {
      const didSaveLastUsedStart = saveStoredCoordinate({
        coordinate: nextRequest.start,
        key: LAST_USED_START_STORAGE_KEY,
        storage: browserLocalStorage,
      });

      if (didSaveLastUsedStart) {
        setLastUsedStart(nextRequest.start);
      }
    }

    latestRoutePreviewRequestIdRef.current = nextRequestId;
    setPreviewCandidateIndex(options.candidateIndex);
    setLastSubmittedRequest(nextRequest);
    setLastSubmittedSeed(options.randomSeed);
    setRoutePreview(null);
    setRoutePreviewRequestError(null);
    setIsRequestingRoutePreview(true);

    try {
      const previewResponse = await requestRoutePreview({
        apiBaseUrl: webRuntimeConfig.apiBaseUrl,
        request: nextRequest,
      });

      if (latestRoutePreviewRequestIdRef.current !== nextRequestId) {
        return;
      }

      setRoutePreview(previewResponse);
    } catch (error) {
      if (latestRoutePreviewRequestIdRef.current !== nextRequestId) {
        return;
      }

      setRoutePreviewRequestError(getErrorMessage(error));
    } finally {
      if (latestRoutePreviewRequestIdRef.current === nextRequestId) {
        setIsRequestingRoutePreview(false);
      }
    }
  }

  function requestRoute() {
    void submitRoutePreviewRequest({
      candidateIndex: 1,
      randomSeed: null,
    });
  }

  function requestVariation() {
    const nextCandidateIndex = hasRoutePreview ? previewCandidateIndex + 1 : 1;

    void submitRoutePreviewRequest({
      candidateIndex: nextCandidateIndex,
      randomSeed: `draft-variation-${nextCandidateIndex}`,
    });
  }

  function startNavigation() {
    if (!canStartNavigation || !navigableRoutePreview) {
      return;
    }

    setNavigationFollowMode("follow_position");
    setNavigationManualCenter(null);
    setNavigationSession({
      instructions: navigableRoutePreview.instructions ?? [],
      routeGeometry: navigableRoutePreview.geometry,
      routeId: navigableRoutePreview.routeId,
      routeStatus: navigableRoutePreview.status,
    });
  }

  function stopNavigation() {
    setNavigationFollowMode("follow_position");
    setNavigationManualCenter(null);
    setNavigationSession(null);
  }

  return (
    <main className="planner-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Pathbadger</p>
          <h1>Plan a trail-first route on a live self-hosted map.</h1>
          <p className="lead">
            The planner now sends real route-preview requests, renders honest
            backend warnings and summary data, and is ready to show routed map
            geometry without mixing in navigation-only state.
          </p>
        </div>
        <div className="hero-status card">
          <div className="status-row">
            <span className="status-pill status-pill--active">
              Planning state active
            </span>
            <span
              className={`status-pill${
                isNavigationActive ? " status-pill--active" : ""
              }`}
            >
              {isNavigationActive
                ? "Navigation session live"
                : "Navigation later"}
            </span>
          </div>
          <p>
            Region target: <strong>{webRuntimeConfig.regionName}</strong>
          </p>
          <p className="contract-line">
            Route API: <code>{webRuntimeConfig.apiBaseUrl}</code>
          </p>
          <p className="contract-line">
            Self-hosted tile style: <code>{webRuntimeConfig.tileStyleUrl}</code>
          </p>
        </div>
      </section>

      <section className="planner-grid">
        <form
          className="planner-panel card"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="panel-heading">
            <div>
              <p className="section-label">Route request</p>
              <h2>Planning controls</h2>
            </div>
            <p className="panel-copy">
              Start point, pass-through picks, and route generation now share
              the same live request path into the backend preview boundary.
            </p>
          </div>
          {isNavigationActive ? (
            <p className="helper-copy helper-copy--locked">
              Planning edits are paused while navigation is active. Stop the
              current navigation session to change the route request again.
            </p>
          ) : null}

          <fieldset className="form-fieldset" disabled={isNavigationActive}>
            <section className="form-section">
              <div className="section-heading">
                <h3>Start point</h3>
                <p>Choose how the route origin should be defined.</p>
              </div>
              <div className="option-grid">
                {(
                  Object.entries(startPointOptions) as [
                    StartPointMode,
                    (typeof startPointOptions)[StartPointMode],
                  ][]
                ).map(([mode, option]) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`start-point-mode-${mode}`}
                    className={`option-card${
                      startPointMode === mode ? " option-card--selected" : ""
                    }`}
                    disabled={option.disabled}
                    onClick={() => handleStartPointModeChange(mode)}
                  >
                    <span className="option-title">{option.label}</span>
                    <span className="option-detail">{option.detail}</span>
                  </button>
                ))}
              </div>
              {startPointMode === "current_position" ? (
                <div className="start-point-status">
                  <div className="status-row">
                    <span
                      className={`status-pill${
                        currentPositionStatusPillClassName
                          ? ` ${currentPositionStatusPillClassName}`
                          : ""
                      }`}
                    >
                      {getCurrentPositionStatusLabel(browserGeolocation)}
                    </span>
                    {browserGeolocation.position ? (
                      <span className="status-pill">
                        Accuracy{" "}
                        {browserGeolocation.position.accuracyMeters === null
                          ? "unknown"
                          : formatWholeMeters(
                              browserGeolocation.position.accuracyMeters,
                            )}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`helper-copy${
                      currentPositionHelperClassName
                        ? ` ${currentPositionHelperClassName}`
                        : ""
                    }`}
                  >
                    {getCurrentPositionHelperCopy(browserGeolocation)}
                  </p>
                </div>
              ) : null}
              {startPointMode === "map_point" ? (
                <p className="helper-copy">
                  Map-selected start:{" "}
                  <code>{formatCoordinate(mapSelectedStart)}</code>. Click the
                  planning map to move it.
                </p>
              ) : null}
              {startPointMode === "saved_default" && savedDefaultStart ? (
                <p className="helper-copy helper-copy--active">
                  Remembered default start:{" "}
                  <code>{formatCoordinate(savedDefaultStart)}</code>.
                </p>
              ) : null}
              {startPointMode === "last_used" && lastUsedStart ? (
                <p
                  className="helper-copy helper-copy--active"
                  data-testid="last-used-start-status"
                >
                  Last used start:{" "}
                  <code>{formatCoordinate(lastUsedStart)}</code>.
                </p>
              ) : null}
              <div className="start-point-status">
                <div className="button-row">
                  <button
                    type="button"
                    data-testid="save-remembered-default-start"
                    className="button button--ghost"
                    disabled={!canSaveRememberedDefault}
                    onClick={saveCurrentStartAsRememberedDefault}
                  >
                    {rememberedDefaultButtonLabel}
                  </button>
                </div>
                <p
                  className={`helper-copy ${rememberedDefaultHelperClassName}`}
                  data-testid="remembered-default-status"
                >
                  {rememberedDefaultHelperCopy}
                </p>
              </div>
            </section>

            <section className="form-section">
              <div className="section-heading">
                <h3>Activity</h3>
                <p>
                  Keep the request aligned with legal routing and trail usage.
                </p>
              </div>
              <div className="segmented-grid">
                {activityOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-testid={`activity-option-${option}`}
                    className={`segment${
                      activity === option ? " segment--selected" : ""
                    }`}
                    onClick={() => handleActivityChange(option)}
                  >
                    {activityLabels[option]}
                  </button>
                ))}
              </div>
              <p
                className={`helper-copy ${activityPreferenceHelperClassName}`}
                data-testid="activity-preference-status"
              >
                {activityPreferenceHelperCopy}
              </p>
            </section>

            <section className="form-section">
              <div className="section-heading">
                <h3>Target distance</h3>
                <p>{getTargetDistanceSectionCopy()}</p>
              </div>
              <div className="distance-controls">
                <label className="distance-input">
                  <span>Target km</span>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    step="0.5"
                    value={targetDistanceKm}
                    onChange={(event) =>
                      setTargetDistanceKm(Number(event.target.value) || 1)
                    }
                  />
                </label>
                <input
                  className="distance-slider"
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  value={targetDistanceKm}
                  onChange={(event) =>
                    setTargetDistanceKm(Number(event.target.value))
                  }
                />
              </div>
            </section>

            <section className="form-section">
              <div className="section-heading">
                <h3>Surface preference</h3>
                <p>{getSurfacePreferenceSectionCopy()}</p>
              </div>
              <div className="segmented-grid segmented-grid--surface">
                {surfacePreferenceOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    data-testid={`surface-preference-option-${option}`}
                    className={`segment${
                      surfacePreference === option ? " segment--selected" : ""
                    }`}
                    onClick={() => handleSurfacePreferenceChange(option)}
                  >
                    {surfaceLabels[option]}
                  </button>
                ))}
              </div>
              <p
                className={`helper-copy ${surfacePreferenceHelperClassName}`}
                data-testid="surface-preference-status"
              >
                {surfacePreferenceHelperCopy}
              </p>
            </section>

            <section className="form-section">
              <div className="section-heading">
                <h3>Pass-through points</h3>
                <p>
                  Pass-through waypoints now come from live map clicks. Local
                  place search remains later scope and is not part of the
                  supported planner yet.
                </p>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className={`button ${
                    isAwaitingPassThroughPoint
                      ? "button--secondary"
                      : "button--primary"
                  }`}
                  onClick={togglePassThroughPointSelection}
                >
                  {isAwaitingPassThroughPoint
                    ? "Cancel map click"
                    : "Add next map click"}
                </button>
              </div>
              <p className="helper-copy">
                {isAwaitingPassThroughPoint
                  ? `Click the planning map to add pass-through point ${passThroughPoints.length + 1}.`
                  : "Each pass-through point is created from a real map click and can still be removed from the list. Local place search stays future scope for now."}
              </p>
              {passThroughPoints.length > 0 ? (
                <ul className="pass-through-list">
                  {passThroughPoints.map((point) => (
                    <li key={point.id} className="pass-through-item">
                      <div>
                        <strong>{point.label}</strong>
                        <span>
                          {point.coordinate.lat.toFixed(4)},{" "}
                          {point.coordinate.lon.toFixed(4)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mini-action"
                        onClick={() => removePassThroughPoint(point.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state">
                  No required pass-through points yet. The route can stay fully
                  spontaneous.
                </p>
              )}
            </section>

            <section className="form-section form-section--actions">
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={
                    isRequestingRoutePreview ||
                    isCurrentPositionPendingRouteGeneration
                  }
                  onClick={requestRoute}
                >
                  {isRequestingRoutePreview
                    ? "Generating..."
                    : "Generate route"}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={
                    isRequestingRoutePreview ||
                    isCurrentPositionPendingRouteGeneration
                  }
                  onClick={requestVariation}
                >
                  {isRequestingRoutePreview
                    ? "Waiting for preview..."
                    : "Generate variation"}
                </button>
              </div>
              <p className="helper-copy">
                {isRequestingRoutePreview
                  ? `Requesting candidate ${previewCandidateIndex} from the backend route boundary now.`
                  : isCurrentPositionPendingRouteGeneration
                    ? getCurrentPositionRouteBlockingMessage(browserGeolocation)
                    : routePreviewRequestError
                      ? routePreviewRequestError
                      : isRoutePreviewStale
                        ? "Planning inputs changed since the last routed preview. Generate again to refresh the map and summary."
                        : hasRoutePreview
                          ? "The planner now renders a real backend route preview, including warnings and geometry when the API can provide them."
                          : "Generate a route to call the backend preview boundary for the first time."}
              </p>
            </section>
          </fieldset>
        </form>

        <section className="preview-column">
          <article className="card preview-card">
            <div className="panel-heading">
              <div>
                <p className="section-label">Route planning state</p>
                <h2>Planning map</h2>
              </div>
              <div className="status-row">
                <span className="status-pill status-pill--active">
                  Candidate {previewCandidateIndex}
                </span>
                {routePreview ? (
                  <span
                    className={`status-pill ${getRouteStatusClass(
                      routePreview.status,
                    )}`}
                  >
                    {routeStatusLabels[routePreview.status]}
                  </span>
                ) : null}
                {isRoutePreviewStale ? (
                  <span className="status-pill status-pill--warning">
                    Request changed
                  </span>
                ) : null}
              </div>
            </div>

            <PlanningMap
              center={mapCenter}
              centerLabel={mapCenterLabel}
              currentPosition={navigationSnapshot?.currentPosition ?? null}
              currentPositionLabel={
                navigationSnapshot
                  ? getNavigationMapMarkerLabel({
                      hasFreshPosition: navigationHasFreshPosition,
                      navigationSnapshot,
                    })
                  : null
              }
              isMapStartActive={
                !isNavigationActive && startPointMode === "map_point"
              }
              isNavigationActive={isNavigationActive}
              interactionMode={isNavigationActive ? "idle" : mapInteractionMode}
              navigationFollowMode={
                isNavigationActive ? navigationFollowMode : null
              }
              navigationBearingDegrees={
                isNavigationActive
                  ? navigationOrientationState.appliedBearingDegrees
                  : 0
              }
              navigationOrientationLabel={
                isNavigationActive
                  ? navigationOrientationState.indicatorLabel
                  : "North up"
              }
              onNavigationManualPan={handleNavigationManualPan}
              onMapSelect={
                isNavigationActive ? ignoreMapSelection : handleMapSelection
              }
              onNavigationViewportChange={handleNavigationViewportChange}
              passThroughPoints={passThroughPoints}
              regionName={webRuntimeConfig.regionName}
              routeGeometry={mapRouteGeometry}
              routeStatus={mapRouteStatus}
              startPoint={startPoint.coordinate}
              startPointLabel={startPoint.label}
              styleUrl={webRuntimeConfig.tileStyleUrl}
            />

            <div className="preview-grid">
              <div className="preview-stat">
                <span>Start mode</span>
                <strong>{startPoint.label}</strong>
              </div>
              <div className="preview-stat">
                <span>Activity</span>
                <strong>{activityLabels[activity]}</strong>
              </div>
              <div className="preview-stat">
                <span>Distance</span>
                <strong>{targetDistanceKm.toFixed(1)} km</strong>
              </div>
              <div className="preview-stat">
                <span>Surface</span>
                <strong>{surfaceLabels[surfacePreference]}</strong>
              </div>
            </div>

            <div className="route-response">
              <div className="section-heading">
                <h3>Routed preview response</h3>
                <p>
                  The first backend preview now returns summary data, warnings,
                  and route geometry through the shared response contract.
                </p>
              </div>

              {routePreviewRequestError ? (
                <div className="response-banner response-banner--error">
                  <strong>Preview request failed.</strong>
                  <span>{routePreviewRequestError}</span>
                </div>
              ) : null}

              {isRequestingRoutePreview ? (
                <div className="response-banner response-banner--pending">
                  <strong>Requesting routed preview.</strong>
                  <span>
                    Waiting for candidate {previewCandidateIndex} from{" "}
                    <code>{webRuntimeConfig.apiBaseUrl}</code>.
                  </span>
                </div>
              ) : null}

              {routePreview ? (
                <>
                  <div className="preview-grid">
                    <div className="preview-stat">
                      <span>Status</span>
                      <strong>{routeStatusLabels[routePreview.status]}</strong>
                    </div>
                    <div className="preview-stat">
                      <span>Route id</span>
                      <strong>{routePreview.routeId}</strong>
                    </div>
                    <div className="preview-stat">
                      <span>Distance</span>
                      <strong>
                        {routePreview.summary
                          ? `${routePreview.summary.totalDistanceKm.toFixed(2)} km`
                          : "Unavailable"}
                      </strong>
                    </div>
                    <div className="preview-stat">
                      <span>Delta</span>
                      <strong>
                        {routePreview.summary
                          ? formatDistanceDelta(
                              routePreview.summary.distanceDeltaMeters,
                            )
                          : "Unavailable"}
                      </strong>
                    </div>
                    <div className="preview-stat">
                      <span>Elevation</span>
                      <strong>
                        {routePreview.summary?.elevationGainMeters === null
                          ? "Unknown"
                          : routePreview.summary?.elevationGainMeters
                            ? `${Math.round(routePreview.summary.elevationGainMeters)} m`
                            : "0 m"}
                      </strong>
                    </div>
                    <div className="preview-stat">
                      <span>Warnings</span>
                      <strong>{routePreview.warnings.length}</strong>
                    </div>
                  </div>

                  <div className="surface-summary">
                    <div className="section-heading">
                      <h3>Surface composition</h3>
                      <p>{routeSurfaceSummaryMessage}</p>
                    </div>
                    <div className="surface-summary-grid">
                      {routeSurfaceSummaryCards.map((card) => (
                        <div key={card.id} className="surface-summary-card">
                          <span>{card.label}</span>
                          <strong>{card.valueText}</strong>
                          <div
                            className="surface-summary-meter"
                            aria-hidden="true"
                          >
                            <div
                              className="surface-summary-meter__fill"
                              style={{
                                width:
                                  card.meterPercent === null
                                    ? "0%"
                                    : `${card.meterPercent}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {routePreview.warnings.length > 0 ? (
                    <ul className="warning-list">
                      {routePreview.warnings.map((warning) => (
                        <li key={`${warning.code}-${warning.message}`}>
                          <strong>{warning.code}</strong>
                          <span>{warning.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="helper-copy">
                      No routed-preview warnings for this candidate.
                    </p>
                  )}

                  <p className="response-note">
                    Candidate {previewCandidateIndex}{" "}
                    {lastSubmittedSeed
                      ? `used random seed ${lastSubmittedSeed}.`
                      : "used the backend's default deterministic seed."}{" "}
                    {routePreview.geometry
                      ? `The live map is rendering ${routePreview.geometry.coordinates.length} route coordinates.`
                      : "No route geometry is available for the map yet."}
                  </p>

                  {isRoutePreviewStale ? (
                    <p className="response-note response-note--warning">
                      Planning inputs changed since this preview was generated.
                      Generate again to refresh the map and summary.
                    </p>
                  ) : null}
                </>
              ) : !isRequestingRoutePreview && !routePreviewRequestError ? (
                <p className="empty-state">
                  No routed preview yet. Generate a route to call the backend
                  and populate the map with real preview state.
                </p>
              ) : null}
            </div>

            <div className="request-preview">
              <div className="section-heading">
                <h3>Current request contract preview</h3>
                <p>
                  The planner still shows the live request shape that the API
                  boundary expects.
                </p>
              </div>
              <pre>
                <code>{requestPreviewCode}</code>
              </pre>
            </div>

            {responsePreviewCode ? (
              <div className="request-preview">
                <div className="section-heading">
                  <h3>Latest response contract preview</h3>
                  <p>
                    The most recent backend response stays visible for
                    inspection alongside the summarized preview state.
                  </p>
                </div>
                <pre>
                  <code>{responsePreviewCode}</code>
                </pre>
              </div>
            ) : null}
          </article>

          <article className="card navigation-session">
            <div className="panel-heading">
              <div>
                <p className="section-label">Execution state</p>
                <h2>
                  {isNavigationActive
                    ? "Navigation session live"
                    : canStartNavigation
                      ? "Navigation ready"
                      : "Navigation waits for a route"}
                </h2>
              </div>
              <span
                className={`status-pill${
                  isNavigationActive
                    ? " status-pill--active"
                    : canStartNavigation
                      ? ""
                      : " status-pill--warning"
                }`}
              >
                {isNavigationActive
                  ? "Following route"
                  : canStartNavigation
                    ? "Ready to start"
                    : "Waiting for preview"}
              </span>
            </div>
            <div
              className="navigation-runtime-caveats"
              data-testid="navigation-runtime-caveats"
            >
              <div className="section-heading">
                <h3>Navigation runtime mode</h3>
                <p>
                  Choose whether live navigation should favor fresher GPS fixes
                  or lower browser geolocation churn.
                </p>
              </div>
              <div
                className="option-grid"
                data-testid="navigation-runtime-mode"
              >
                {navigationRuntimeModeOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    data-testid={`navigation-runtime-mode-${option.mode}`}
                    className={`option-card${
                      navigationRuntimeMode === option.mode
                        ? " option-card--selected"
                        : ""
                    }`}
                    onClick={() => setNavigationRuntimeMode(option.mode)}
                  >
                    <span className="option-title">{option.label}</span>
                    <span className="option-detail">{option.detail}</span>
                  </button>
                ))}
              </div>
              <p
                className={`helper-copy ${
                  navigationRuntimeMode === "battery_saver"
                    ? "helper-copy--warning"
                    : "helper-copy--active"
                }`}
                data-testid="navigation-runtime-mode-summary"
              >
                {navigationRuntimeModeSummary}
              </p>
              <div className="section-heading">
                <h3>Map orientation</h3>
                <p>
                  Keep the map north-up by default or request heading-up when
                  the browser can provide a trustworthy live heading.
                </p>
              </div>
              <div
                className="option-grid"
                data-testid="navigation-orientation-mode"
              >
                {navigationOrientationModeOptions.map((option) => (
                  <button
                    key={option.mode}
                    type="button"
                    data-testid={`navigation-orientation-mode-${option.mode}`}
                    className={`option-card${
                      navigationOrientationMode === option.mode
                        ? " option-card--selected"
                        : ""
                    }`}
                    onClick={() => setNavigationOrientationMode(option.mode)}
                  >
                    <span className="option-title">{option.label}</span>
                    <span className="option-detail">{option.detail}</span>
                  </button>
                ))}
              </div>
              <p
                className={`helper-copy ${
                  navigationOrientationMode === "heading_up" &&
                  !navigationOrientationState.isHeadingUpActive
                    ? "helper-copy--warning"
                    : "helper-copy--active"
                }`}
                data-testid="navigation-orientation-summary"
              >
                {navigationOrientationState.helperCopy}
              </p>
              <div className="section-heading">
                <h3>Browser runtime caveats</h3>
                <p>{getNavigationRuntimeCaveatSummary()}</p>
              </div>
              <ul className="warning-list">
                {getNavigationRuntimeCaveats().map((caveat) => (
                  <li key={caveat.id}>
                    <strong>{caveat.title}</strong>
                    <span>{caveat.body}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p
              className="helper-copy helper-copy--warning"
              data-testid="navigation-gps-guardrail-summary"
            >
              {getNavigationGpsGuardrailPreviewCopy()}
            </p>
            {isNavigationActive && navigationSession ? (
              <>
                <p className="panel-copy">
                  {getNavigationTrackingPanelCopy({
                    browserGeolocation,
                    hasFreshPosition: navigationHasFreshPosition,
                    hasLowConfidencePosition:
                      navigationHasLowConfidencePosition,
                    hasTrackedPosition: navigationHasTrackedPosition,
                    lowConfidenceCopy:
                      navigationGpsConfidence.lowConfidenceCopy,
                  })}
                </p>
                <div className="status-row">
                  <span
                    className={`status-pill${
                      navigationTrackingStatusPillClassName
                        ? ` ${navigationTrackingStatusPillClassName}`
                        : ""
                    }`}
                  >
                    {navigationTrackingStatusLabel}
                  </span>
                  <span
                    className={`status-pill ${navigationFollowStatusPillClassName}`}
                  >
                    {navigationFollowStatusLabel}
                  </span>
                  <span
                    className={`status-pill ${navigationOrientationState.statusPillClassName}`}
                  >
                    {navigationOrientationState.statusLabel}
                  </span>
                  <span
                    className={`status-pill ${
                      navigationRuntimeMode === "battery_saver"
                        ? "status-pill--warning"
                        : "status-pill--active"
                    }`}
                  >
                    {navigationRuntimeModeLabel}
                  </span>
                  <span className="status-pill">
                    {navigationSession.routeStatus === "partial"
                      ? "Partial preview route"
                      : "Full preview route"}
                  </span>
                  {navigationTrackedPosition?.accuracyMeters !== null &&
                  navigationTrackedPosition?.accuracyMeters !== undefined ? (
                    <span className="status-pill">
                      Accuracy{" "}
                      {formatWholeMeters(
                        navigationTrackedPosition.accuracyMeters,
                      )}
                    </span>
                  ) : null}
                </div>
                <div
                  className={`response-banner${navigationTrackingBannerClassName}`}
                >
                  <strong>{navigationTrackingBannerTitle}</strong>
                  <span>{navigationTrackingBannerCopy}</span>
                </div>
                {navigationSnapshot ? (
                  <>
                    {navigationHasLowConfidencePosition ? (
                      <div className="response-banner response-banner--pending">
                        <strong>Approximate route state</strong>
                        <span>
                          {navigationGpsConfidence.lowConfidenceCopy} Current
                          route deviation is about{" "}
                          {formatWholeMeters(
                            navigationSnapshot.offRouteDistanceMeters,
                          )}
                          , so Pathbadger is not escalating a hard off-route
                          warning until a tighter browser fix arrives.
                        </span>
                      </div>
                    ) : navigationSnapshot.isOffRoute ? (
                      <div className="response-banner response-banner--error">
                        <strong>Off-route warning</strong>
                        <span>
                          Current position is about{" "}
                          {formatWholeMeters(
                            navigationSnapshot.offRouteDistanceMeters,
                          )}{" "}
                          from the route line, which exceeds the{" "}
                          {formatWholeMeters(
                            navigationSnapshot.offRouteWarningThresholdMeters,
                          )}{" "}
                          warning threshold. MVP navigation does not reroute
                          yet.
                        </span>
                      </div>
                    ) : (
                      <div className="response-banner response-banner--pending">
                        <strong>On-route state</strong>
                        <span>
                          Current position is staying within the{" "}
                          {formatWholeMeters(
                            navigationSnapshot.offRouteWarningThresholdMeters,
                          )}{" "}
                          off-route threshold.
                        </span>
                      </div>
                    )}
                    {navigationSnapshot.nextInstruction ? (
                      <div className="response-banner">
                        <strong>
                          Next instruction:{" "}
                          {navigationSnapshot.nextInstruction.instruction.text}
                        </strong>
                        <span>
                          In{" "}
                          {formatNavigationDistance(
                            navigationSnapshot.nextInstruction.distanceMeters,
                          )}
                          {navigationSnapshot.nextInstruction.instruction
                            .streetName
                            ? ` on ${navigationSnapshot.nextInstruction.instruction.streetName}.`
                            : "."}
                        </span>
                      </div>
                    ) : (
                      <p className="helper-copy">
                        This routed preview does not include turn instructions
                        yet, so navigation can currently show route progress
                        only.
                      </p>
                    )}
                    <div className="preview-grid preview-grid--navigation">
                      <div className="preview-stat">
                        <span>Current position</span>
                        <strong>
                          {formatCoordinate(navigationSnapshot.currentPosition)}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Position source</span>
                        <strong>
                          {navigationHasLowConfidencePosition
                            ? "Low-confidence live GPS"
                            : navigationHasFreshPosition
                              ? "Live browser GPS"
                              : "Last known GPS fix"}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Map follow</span>
                        <strong>{navigationFollowStatusLabel}</strong>
                      </div>
                      <div className="preview-stat">
                        <span>Orientation</span>
                        <strong>
                          {navigationOrientationState.indicatorLabel}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Runtime mode</span>
                        <strong>{navigationRuntimeModeLabel}</strong>
                      </div>
                      <div className="preview-stat">
                        <span>Completed</span>
                        <strong>
                          {formatDistanceKilometers(
                            navigationSnapshot.completedDistanceMeters,
                          )}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Remaining</span>
                        <strong>
                          {formatDistanceKilometers(
                            navigationSnapshot.remainingDistanceMeters,
                          )}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Total</span>
                        <strong>
                          {formatDistanceKilometers(
                            navigationSnapshot.totalDistanceMeters,
                          )}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>
                          {navigationHasLowConfidencePosition
                            ? "Approx. progress"
                            : "Progress"}
                        </span>
                        <strong>{navigationSnapshot.progressPercent}%</strong>
                      </div>
                      <div className="preview-stat">
                        <span>Route id</span>
                        <strong>{navigationSession.routeId}</strong>
                      </div>
                      <div className="preview-stat">
                        <span>
                          {navigationHasLowConfidencePosition
                            ? "Approx. route deviation"
                            : "Route deviation"}
                        </span>
                        <strong>
                          {formatWholeMeters(
                            navigationSnapshot.offRouteDistanceMeters,
                          )}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Current speed</span>
                        <strong>
                          {formatNavigationSpeedKmh(
                            navigationSpeedMetrics?.currentSpeedKmh ?? null,
                          )}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Average speed</span>
                        <strong>
                          {formatNavigationSpeedKmh(
                            navigationSpeedMetrics?.averageSpeedKmh ?? null,
                          )}
                        </strong>
                      </div>
                      {navigationTrackedPosition ? (
                        <div className="preview-stat">
                          <span>GPS timestamp</span>
                          <strong>
                            {formatTimeOfDay(
                              navigationTrackedPosition.timestampMs,
                            )}
                          </strong>
                        </div>
                      ) : null}
                    </div>
                    {navigationSpeedHelperCopy ? (
                      <p className="helper-copy">{navigationSpeedHelperCopy}</p>
                    ) : null}
                    {navigationGpsConfidence.lowConfidenceCopy ? (
                      <p
                        className="helper-copy helper-copy--warning"
                        data-testid="navigation-gps-confidence-copy"
                      >
                        {navigationGpsConfidence.lowConfidenceCopy}
                      </p>
                    ) : null}
                    <p
                      className={`helper-copy ${
                        isNavigationFollowingPosition
                          ? "helper-copy--active"
                          : "helper-copy--warning"
                      }`}
                    >
                      {navigationFollowHelperCopy}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="preview-grid preview-grid--navigation">
                      <div className="preview-stat">
                        <span>Route id</span>
                        <strong>{navigationSession.routeId}</strong>
                      </div>
                      <div className="preview-stat">
                        <span>Route status</span>
                        <strong>
                          {navigationSession.routeStatus === "partial"
                            ? "Partial preview route"
                            : "Full preview route"}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Route line</span>
                        <strong>
                          {navigationSession.routeGeometry.coordinates.length}{" "}
                          points
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Instructions</span>
                        <strong>{navigationSession.instructions.length}</strong>
                      </div>
                      <div className="preview-stat">
                        <span>Map follow</span>
                        <strong>{navigationFollowStatusLabel}</strong>
                      </div>
                      <div className="preview-stat">
                        <span>Orientation</span>
                        <strong>
                          {navigationOrientationState.indicatorLabel}
                        </strong>
                      </div>
                      <div className="preview-stat">
                        <span>Runtime mode</span>
                        <strong>{navigationRuntimeModeLabel}</strong>
                      </div>
                    </div>
                    <ul className="handoff-list">
                      <li>
                        Browser geolocation must produce a usable current
                        position before progress, remaining distance, and
                        off-route metrics can render.
                      </li>
                      <li>
                        Navigation no longer invents a synthetic fallback marker
                        when GPS is missing or denied.
                      </li>
                      <li>
                        Restore browser location access or stop navigation if
                        this state persists.
                      </li>
                    </ul>
                    <p
                      className={`helper-copy ${
                        isNavigationFollowingPosition
                          ? "helper-copy--active"
                          : "helper-copy--warning"
                      }`}
                    >
                      {navigationFollowHelperCopy}
                    </p>
                    <p
                      className={`helper-copy ${
                        navigationOrientationMode === "heading_up" &&
                        !navigationOrientationState.isHeadingUpActive
                          ? "helper-copy--warning"
                          : "helper-copy--active"
                      }`}
                    >
                      {navigationOrientationState.helperCopy}
                    </p>
                  </>
                )}
                {navigationSnapshot ? (
                  <p className="helper-copy helper-copy--active">
                    {navigationHasFreshPosition
                      ? "Live browser geolocation is driving the marker now."
                      : "The current marker reflects the last known browser GPS fix while Pathbadger waits for a fresh update."}
                  </p>
                ) : null}
                <div className="button-row">
                  {navigationFollowActionLabel ? (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={recenterNavigationMap}
                    >
                      {navigationFollowActionLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={stopNavigation}
                  >
                    Stop navigation
                  </button>
                </div>
              </>
            ) : canStartNavigation && navigableRoutePreview ? (
              <>
                <p className="panel-copy">
                  A routed preview is ready to enter execution mode. Starting
                  navigation keeps the current route line mounted, freezes
                  planning edits, and computes progress locally from the route
                  geometry.
                </p>
                <div className="preview-grid preview-grid--navigation">
                  <div className="preview-stat">
                    <span>Route id</span>
                    <strong>{navigableRoutePreview.routeId}</strong>
                  </div>
                  <div className="preview-stat">
                    <span>Status</span>
                    <strong>
                      {routeStatusLabels[navigableRoutePreview.status]}
                    </strong>
                  </div>
                  <div className="preview-stat">
                    <span>Route line</span>
                    <strong>
                      {navigableRoutePreview.geometry.coordinates.length} points
                    </strong>
                  </div>
                  <div className="preview-stat">
                    <span>Total</span>
                    <strong>
                      {navigableRoutePreview.summary
                        ? `${navigableRoutePreview.summary.totalDistanceKm.toFixed(2)} km`
                        : "Unavailable"}
                    </strong>
                  </div>
                  <div className="preview-stat">
                    <span>Instructions</span>
                    <strong>
                      {navigableRoutePreview.instructions?.length ?? 0}
                    </strong>
                  </div>
                  <div className="preview-stat">
                    <span>Orientation</span>
                    <strong>{navigationOrientationState.indicatorLabel}</strong>
                  </div>
                  <div className="preview-stat">
                    <span>Runtime mode</span>
                    <strong>{navigationRuntimeModeLabel}</strong>
                  </div>
                </div>
                <p className="helper-copy">
                  {browserGeolocation.status === "ready"
                    ? "Browser geolocation is already available, so starting navigation will follow the live GPS marker immediately."
                    : "Starting navigation now will request browser geolocation for live position updates. If the browser cannot provide a usable fix, the session will pause with an explicit GPS error instead of inventing a fallback marker."}
                </p>
                <p className="helper-copy helper-copy--warning">
                  {getNavigationGpsGuardrailPreviewCopy()}
                </p>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={startNavigation}
                >
                  Start navigation
                </button>
              </>
            ) : (
              <>
                <p className="panel-copy">
                  Route execution now has its own real entry point, but it still
                  waits for a usable routed preview with geometry before a
                  session can start.
                </p>
                <ul className="handoff-list">
                  <li>
                    Generate a successful or partial route preview with geometry
                    before starting navigation.
                  </li>
                  <li>
                    Planning edits stay separate from route-following once a
                    navigation session is active.
                  </li>
                  <li>
                    Once a usable route exists, navigation can surface next
                    instruction cues and conservative off-route warnings locally
                    in the browser.
                  </li>
                </ul>
                <p className="helper-copy">
                  {isRoutePreviewStale
                    ? "The latest routed preview is stale. Generate again to refresh the route before starting navigation."
                    : "No navigable routed preview is available yet."}
                </p>
                <p className="helper-copy helper-copy--warning">
                  {getNavigationGpsGuardrailPreviewCopy()}
                </p>
                <button type="button" className="button button--ghost" disabled>
                  Start navigation
                </button>
              </>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}

function formatCoordinate(coordinate: Coordinate) {
  return `${coordinate.lat.toFixed(4)}, ${coordinate.lon.toFixed(4)}`;
}

function formatDistanceDelta(distanceDeltaMeters: number) {
  const sign = distanceDeltaMeters > 0 ? "+" : "";

  return `${sign}${distanceDeltaMeters} m`;
}

function formatDistanceKilometers(distanceMeters: number) {
  return `${(distanceMeters / 1_000).toFixed(2)} km`;
}

function formatNavigationDistance(distanceMeters: number) {
  if (distanceMeters >= 1_000) {
    return `${(distanceMeters / 1_000).toFixed(2)} km`;
  }

  return formatWholeMeters(distanceMeters);
}

function formatWholeMeters(distanceMeters: number) {
  return `${Math.round(distanceMeters)} m`;
}

function formatTimeOfDay(timestampMs: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestampMs);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Route preview request failed before the planner received a usable response.";
}

function getRouteStatusClass(status: RouteGenerateResponse["status"]) {
  if (status === "success") {
    return "status-pill--active";
  }

  if (status === "partial") {
    return "status-pill--warning";
  }

  return "status-pill--error";
}

function getCurrentPositionOptionDetail(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "ready":
      return "Using the latest browser GPS fix for route generation.";
    case "requesting":
      return "Waiting for browser permission and a usable GPS fix.";
    case "denied":
      return "Location permission is denied until it is re-enabled.";
    case "unsupported":
      return "This browser cannot provide a live GPS start point.";
    case "unavailable":
      return "Browser geolocation is available, but the current fix is unavailable.";
    case "idle":
    default:
      return "Switch here to request browser GPS permission.";
  }
}

function getCurrentPositionStatusLabel(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "ready":
      return "GPS fix ready";
    case "requesting":
      return "Requesting GPS";
    case "denied":
      return "Permission denied";
    case "unsupported":
      return "Geolocation unsupported";
    case "unavailable":
      return "GPS unavailable";
    case "idle":
    default:
      return "GPS idle";
  }
}

function getCurrentPositionStatusPillClassName(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "ready":
      return "status-pill--active";
    case "requesting":
      return "status-pill--warning";
    case "denied":
    case "unsupported":
    case "unavailable":
      return "status-pill--error";
    case "idle":
    default:
      return "";
  }
}

function getCurrentPositionHelperClassName(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "ready":
      return "helper-copy--active";
    case "requesting":
      return "helper-copy--warning";
    case "denied":
    case "unsupported":
    case "unavailable":
      return "helper-copy--error";
    case "idle":
    default:
      return "";
  }
}

function getCurrentPositionHelperCopy(
  browserGeolocation: BrowserGeolocationState,
) {
  if (browserGeolocation.status === "ready" && browserGeolocation.position) {
    const accuracyText =
      browserGeolocation.position.accuracyMeters === null
        ? "Accuracy is currently unavailable."
        : `Accuracy is about ${formatWholeMeters(
            browserGeolocation.position.accuracyMeters,
          )}.`;

    return `Using browser location ${formatCoordinate(
      browserGeolocation.position.coordinate,
    )} as the route start. ${accuracyText}`;
  }

  if (browserGeolocation.status === "requesting") {
    return "The browser location watch is active. Route generation will stay paused until permission is granted and a usable fix arrives.";
  }

  if (browserGeolocation.message) {
    return browserGeolocation.message;
  }

  return "Switch to Current GPS position to request browser location access.";
}

function getCurrentPositionRouteBlockingMessage(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "requesting":
      return "Route generation waits for browser permission and a usable GPS fix before Current GPS position can be used.";
    case "denied":
      return "Route generation is paused because browser location permission was denied. Choose another start point or re-enable permission.";
    case "unsupported":
      return "Route generation is paused because this browser does not expose geolocation. Choose another start point.";
    case "unavailable":
      return "Route generation waits for a usable browser GPS fix. Choose another start point or try again once location data is available.";
    case "idle":
    case "ready":
    default:
      return "Route generation waits for the current browser location.";
  }
}

function getNavigationMapMarkerLabel(options: {
  hasFreshPosition: boolean;
  navigationSnapshot: NonNullable<ReturnType<typeof createNavigationSnapshot>>;
}) {
  const prefix = options.hasFreshPosition ? "GPS" : "Last GPS fix";

  if (options.navigationSnapshot.isOffRoute) {
    return `${prefix} off route ${Math.round(
      options.navigationSnapshot.offRouteDistanceMeters,
    )} m`;
  }

  return `${prefix} ${options.navigationSnapshot.progressPercent}%`;
}

function getPlanningPreferenceHelperClassName(options: {
  persistenceFailed: boolean;
  storageAvailable: boolean;
}) {
  return !options.storageAvailable || options.persistenceFailed
    ? "helper-copy--warning"
    : "helper-copy--active";
}

function getPlanningPreferenceHelperCopy(options: {
  name: string;
  persistenceFailed: boolean;
  storageAvailable: boolean;
}) {
  if (!options.storageAvailable || options.persistenceFailed) {
    return `Browser local storage could not be used, so ${options.name.toLowerCase()} will reset on reload in this browser.`;
  }

  return `${options.name} is saved in this browser after each change.`;
}

function serializeComparablePlanningRequest(request: RouteGenerateRequest) {
  return JSON.stringify({
    activity: request.activity,
    passThroughPoints: request.passThroughPoints,
    start: request.start,
    surfacePreference: request.surfacePreference,
    targetDistanceKm: request.targetDistanceKm,
    toleranceMeters: request.toleranceMeters,
  });
}

function getNavigableRoutePreview(
  routePreview: RouteGenerateResponse | null,
): NavigableRoutePreview | null {
  if (
    routePreview?.geometry &&
    (routePreview.status === "success" || routePreview.status === "partial")
  ) {
    return routePreview as NavigableRoutePreview;
  }

  return null;
}
