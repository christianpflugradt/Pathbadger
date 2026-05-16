import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  DEFAULT_DISTANCE_TOLERANCE_METERS,
  DEFAULT_PLACE_SEARCH_LIMIT,
  activityOptions,
  surfacePreferenceOptions,
} from "@pathbadger/shared";
import type {
  Activity,
  Coordinate,
  PlaceSearchResponse,
  PlaceSearchResult,
  RouteGeometry,
  RouteGenerateRequest,
  RouteGenerateResponse,
  RouteInstruction,
  SurfacePreference,
} from "@pathbadger/shared";

import type { BrowserGeolocationState } from "./browser-geolocation";
import {
  DEFAULT_BROWSER_GEOLOCATION_OPTIONS,
  requestSingleBrowserGeolocationFix,
  useBrowserGeolocation,
} from "./browser-geolocation";
import { webRuntimeConfig } from "./config";
import {
  getNavigationFollowModeActionLabel,
  getNavigationFollowModeLabel,
} from "./navigation-follow-state";
import type { NavigationFollowMode } from "./navigation-follow-state";
import { getNavigationHeroStatus } from "./navigation-hero-status";
import { getNavigationGpsConfidenceState } from "./navigation-gps-confidence";
import {
  getNavigationOrientationModeOptions,
  getNavigationOrientationState,
} from "./navigation-orientation-state";
import type { NavigationOrientationMode } from "./navigation-orientation-state";
import { createNavigationSnapshot } from "./navigation-session";
import { getNavigationEtaState } from "./navigation-eta-state";
import {
  createNavigationSpeedBaseline,
  formatNavigationSpeedKmh,
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
import {
  getCompactNavigationGpsStatusLabel,
  getCompactNavigationInstructionTitle,
} from "./navigation-guidance-copy";
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
import {
  createMapPassThroughPoint,
  createMapStartSelection,
  createSearchPassThroughPoint,
  createSearchStartSelection,
  getPassThroughPointSourceCopy,
  getPlaceSearchFeedbackClassName,
  getPlaceSearchFeedbackCopy,
  getPlaceSearchRegionGuardrailCopy,
  type PlannerMapStartSelection,
  type PlannerPassThroughPoint,
} from "./planning-place-search-state";
import { searchLocalPlaces } from "./place-search-client";
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
type NavigationSession = {
  instructions: RouteInstruction[];
  routeGeometry: RouteGeometry;
  routeDistanceKm: number | null;
  routeId: string;
  routeStatus: "partial" | "success";
};
type NavigationResetState = {
  reason: "completed" | "stopped";
  routeDistanceKm: number | null;
  routeStatus: "partial" | "success" | null;
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
const DEFAULT_MAP_SELECTED_START_COORDINATE = {
  lat: 53.9015262,
  lon: 9.8325138,
};
const DEFAULT_MAP_SELECTED_START_LABEL =
  "Heidmoorer Straße 18, 24576 Weddelbrook";
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
    label: "Planner-selected point",
    detail: "Live map clicks or local search results set the planning start.",
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
  failed: "Route unavailable",
};
const ACTIVITY_STORAGE_KEY = "pathbadger.activityPreference";
const SAVED_DEFAULT_START_STORAGE_KEY = "pathbadger.savedDefaultStart";
const LAST_USED_START_STORAGE_KEY = "pathbadger.lastUsedStart";
const SURFACE_PREFERENCE_STORAGE_KEY = "pathbadger.surfacePreference";
const NAVIGATION_COMPLETE_THRESHOLD_METERS = 40;
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
  const [mapSelectedStart, setMapSelectedStart] =
    useState<PlannerMapStartSelection>(() => createDefaultMapStartSelection());
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
      }) ?? "mixed",
  );
  const [surfacePreferenceSaveFailed, setSurfacePreferenceSaveFailed] =
    useState(false);
  const [targetDistanceKm, setTargetDistanceKm] = useState(8);
  const [passThroughPoints, setPassThroughPoints] = useState<
    PlannerPassThroughPoint[]
  >([]);
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [placeSearchResponse, setPlaceSearchResponse] =
    useState<PlaceSearchResponse | null>(null);
  const [placeSearchRequestError, setPlaceSearchRequestError] = useState<
    string | null
  >(null);
  const [isRequestingPlaceSearch, setIsRequestingPlaceSearch] = useState(false);
  const [isPlannerDrawerOpen, setIsPlannerDrawerOpen] = useState(false);
  const [previewCandidateIndex, setPreviewCandidateIndex] = useState(1);
  const [routePreview, setRoutePreview] =
    useState<RouteGenerateResponse | null>(null);
  const [navigationSession, setNavigationSession] =
    useState<NavigationSession | null>(null);
  const [navigationResetState, setNavigationResetState] =
    useState<NavigationResetState | null>(null);
  const [navigationRuntimeMode, setNavigationRuntimeMode] =
    useState<NavigationRuntimeMode>("normal");
  const [navigationOrientationMode, setNavigationOrientationMode] =
    useState<NavigationOrientationMode>("heading_up");
  const [navigationFollowMode, setNavigationFollowMode] =
    useState<NavigationFollowMode>("follow_position");
  const [navigationManualCenter, setNavigationManualCenter] =
    useState<Coordinate | null>(null);
  const [navigationSpeedBaseline, setNavigationSpeedBaseline] = useState<{
    completedDistanceMeters: number;
    timestampMs: number;
  } | null>(null);
  const [navigationProgressHintMeters, setNavigationProgressHintMeters] =
    useState<number | null>(null);
  const [lastSubmittedRequest, setLastSubmittedRequest] =
    useState<RouteGenerateRequest | null>(null);
  const [isRequestingRoutePreview, setIsRequestingRoutePreview] =
    useState(false);
  const [routePreviewRequestError, setRoutePreviewRequestError] = useState<
    string | null
  >(null);
  const latestPlaceSearchRequestIdRef = useRef(0);
  const latestRoutePreviewRequestIdRef = useRef(0);
  const nextPassThroughPointIdRef = useRef(0);
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
      detail: mapSelectedStart.label
        ? `Currently set to ${mapSelectedStart.label}.`
        : startPointCatalog.map_point.detail,
      coordinate: mapSelectedStart.coordinate,
    },
    saved_default: {
      ...startPointCatalog.saved_default,
      coordinate: savedDefaultStart ?? mapSelectedStart.coordinate,
      detail: rememberedDefaultOptionDetail,
      disabled: savedDefaultStart === null,
    },
    last_used: {
      ...startPointCatalog.last_used,
      coordinate: lastUsedStart ?? mapSelectedStart.coordinate,
      detail: lastUsedStartOptionDetail,
      disabled: lastUsedStart === null,
    },
  };

  const startPoint =
    startPointMode === "map_point"
      ? {
          ...startPointOptions.map_point,
          detail:
            mapSelectedStart.source === "search" && mapSelectedStart.label
              ? "Choose another local result or click the live map to replace this searched origin."
              : mapSelectedStart.label
                ? `Tap the live map to move the route origin away from ${mapSelectedStart.label}.`
                : "Click the live map to set the route origin.",
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
  const hasVisibleRoutePreview =
    hasRoutePreview &&
    (routePreview.geometry !== null || routePreview.summary !== null);
  const hasFailedRoutePreview = routePreview?.status === "failed";
  const submittedRequestSignature = lastSubmittedRequest
    ? serializeComparablePlanningRequest(lastSubmittedRequest)
    : null;
  const currentRequestSignature =
    serializeComparablePlanningRequest(planningRequest);
  const isRoutePreviewStale =
    submittedRequestSignature !== null &&
    submittedRequestSignature !== currentRequestSignature;
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
          preferredDistanceFromStartMeters: navigationProgressHintMeters ?? 0,
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
  const navigationEtaState = getNavigationEtaState({
    averageSpeedKmh: navigationSpeedMetrics?.averageSpeedKmh ?? null,
    currentSpeedKmh: navigationSpeedMetrics?.currentSpeedKmh ?? null,
    hasFreshPosition: navigationHasFreshPosition,
    hasLowConfidencePosition: navigationHasLowConfidencePosition,
    hasTrackedPosition: navigationHasTrackedPosition,
    remainingDistanceMeters:
      navigationSnapshot?.remainingDistanceMeters ?? null,
  });
  const isNavigationFollowingPosition =
    navigationFollowMode === "follow_position";
  const navigationFollowStatusLabel =
    getNavigationFollowModeLabel(navigationFollowMode);
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
  const navigationHeroStatus = getNavigationHeroStatus({
    canStartNavigation,
    isNavigationActive,
    isRoutePreviewStale,
  });
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
  const placeSearchFeedbackClassName = getPlaceSearchFeedbackClassName({
    errorMessage: placeSearchRequestError,
    isLoading: isRequestingPlaceSearch,
    regionName: webRuntimeConfig.regionName,
    response: placeSearchResponse,
  });
  const placeSearchFeedbackCopy = getPlaceSearchFeedbackCopy({
    errorMessage: placeSearchRequestError,
    isLoading: isRequestingPlaceSearch,
    regionName: webRuntimeConfig.regionName,
    response: placeSearchResponse,
  });
  const placeSearchResults =
    placeSearchResponse?.status === "success"
      ? placeSearchResponse.results
      : [];
  const placeSearchStatusLabel = getPlaceSearchStatusLabel({
    errorMessage: placeSearchRequestError,
    isLoading: isRequestingPlaceSearch,
    response: placeSearchResponse,
  });
  const placeSearchStatusPillClassName = getPlaceSearchStatusPillClassName({
    errorMessage: placeSearchRequestError,
    isLoading: isRequestingPlaceSearch,
    response: placeSearchResponse,
  });
  const plannerJourneyCopy = getPlannerJourneyCopy({
    browserGeolocation,
    canStartNavigation,
    hasFailedRoutePreview,
    hasVisibleRoutePreview,
    isCurrentPositionPendingRouteGeneration,
    isNavigationActive,
    isRequestingRoutePreview,
    isRoutePreviewStale,
    navigationResetState,
    routePreviewRequestError,
  });
  const plannerPrimaryActionLabel = getPlannerPrimaryActionLabel({
    canStartNavigation,
    hasVisibleRoutePreview,
    isCurrentPositionPendingRouteGeneration,
    isNavigationActive,
    isRequestingRoutePreview,
    isRoutePreviewStale,
  });
  const plannerPrimaryActionDisabled =
    !isNavigationActive &&
    (isRequestingRoutePreview || isCurrentPositionPendingRouteGeneration);
  const plannerSecondaryActionLabel = getPlannerSecondaryActionLabel({
    canStartNavigation,
    hasVisibleRoutePreview,
    isAwaitingPassThroughPoint,
    isNavigationActive,
    navigationFollowActionLabel,
  });
  const plannerWaypointActionLabel = isAwaitingPassThroughPoint
    ? "Cancel waypoint"
    : "Add waypoint";
  const plannerDrawerToggleLabel = isNavigationActive
    ? isPlannerDrawerOpen
      ? "Close settings"
      : "Settings"
    : isPlannerDrawerOpen
      ? "Close route settings"
      : "Route settings";
  const plannerPrimaryActionDisplayLabel = isNavigationActive
    ? "Stop"
    : plannerPrimaryActionLabel;
  const plannerSecondaryActionDisplayLabel = plannerSecondaryActionLabel
    ? isNavigationActive
      ? plannerSecondaryActionLabel === "Recenter map"
        ? "Recenter"
        : plannerSecondaryActionLabel === "Re-enable follow"
          ? "Resume follow"
          : plannerSecondaryActionLabel
      : plannerSecondaryActionLabel
    : null;
  const plannerStagePills = getPlannerStagePills({
    canStartNavigation,
    hasFailedRoutePreview,
    hasVisibleRoutePreview,
    isAwaitingPassThroughPoint,
    isNavigationActive,
    isRequestingRoutePreview,
    isRoutePreviewStale,
    passThroughPointCount: passThroughPoints.length,
    startPointLabel: getPlannerStartPointStatusLabel({
      mapSelectedStart,
      startPoint,
      startPointMode,
    }),
  });
  const navigationHudGpsStatusPill = !navigationTrackedPosition
    ? getNavigationWaitingGpsStatusPill(browserGeolocation)
    : navigationSnapshot?.isOffRoute
      ? {
          className: "status-pill--error",
          label: "Off route",
        }
      : navigationHasLowConfidencePosition
        ? {
            className: "status-pill--warning",
            label: getCompactNavigationGpsStatusLabel(navigationGpsConfidence),
          }
        : {
            className: "status-pill--active",
            label: "Live GPS",
          };
  const navigationSettingsSupportCopy = !navigationTrackedPosition
    ? "Allow browser location or retry GPS."
    : navigationSnapshot?.isOffRoute
      ? `${formatWholeMeters(navigationSnapshot.offRouteDistanceMeters)} off route. Rejoin the highlighted line.`
      : navigationHasLowConfidencePosition
        ? `${getCompactNavigationGpsStatusLabel(navigationGpsConfidence)} accuracy. Guidance stays approximate.`
        : "Live guidance is active.";
  const navigationHudStats = isNavigationActive
    ? [
        {
          label: "Left",
          value: navigationSnapshot
            ? formatDistanceKilometers(
                navigationSnapshot.remainingDistanceMeters,
              )
            : routePreview?.summary
              ? `${routePreview.summary.totalDistanceKm.toFixed(2)} km`
              : "Waiting",
        },
        {
          label: "Done",
          value: navigationSnapshot
            ? formatDistanceKilometers(
                navigationSnapshot.completedDistanceMeters,
              )
            : "Waiting",
        },
        ...(navigationEtaState.isAvailable
          ? [
              {
                label: "ETA",
                value: navigationEtaState.estimateLabel,
              },
            ]
          : (() => {
              const speedLabel = formatNavigationSpeedKmh(
                navigationSpeedMetrics?.currentSpeedKmh ?? null,
              );

              return speedLabel === "Unavailable"
                ? []
                : [
                    {
                      label: "Speed",
                      value: speedLabel,
                    },
                  ];
            })()),
      ]
    : [];
  const navigationManeuverTitle = navigationSnapshot?.isOffRoute
    ? "Rejoin the highlighted route"
    : navigationSnapshot?.nextInstruction
      ? getCompactNavigationInstructionTitle(
          navigationSnapshot.nextInstruction.instruction,
        )
      : navigationTrackedPosition
        ? "Continue on route"
        : getNavigationWaitingGpsManeuverTitle(browserGeolocation);
  const navigationManeuverDistanceLabel = !navigationTrackedPosition
    ? getNavigationWaitingGpsManeuverDistanceLabel(browserGeolocation)
    : navigationSnapshot?.isOffRoute
      ? `${formatWholeMeters(navigationSnapshot.offRouteDistanceMeters)} off route`
      : navigationSnapshot?.nextInstruction
        ? `${formatNavigationDistance(
            navigationSnapshot.nextInstruction.distanceMeters,
          )} ahead`
        : "On route";
  const navigationMapHeaderOverlay = isNavigationActive ? (
    <div
      className={`map-maneuver-banner${
        navigationSnapshot?.isOffRoute ? " map-maneuver-banner--warning" : ""
      }`}
      data-testid="navigation-maneuver-banner"
    >
      <div className="map-maneuver-banner__icon" aria-hidden="true">
        {navigationSnapshot?.isOffRoute
          ? "!"
          : getNavigationInstructionSymbol(
              navigationSnapshot?.nextInstruction?.instruction ?? null,
            )}
      </div>
      <div className="map-maneuver-banner__body">
        <span className="map-maneuver-banner__distance">
          {navigationManeuverDistanceLabel}
        </span>
        <strong>{navigationManeuverTitle}</strong>
      </div>
    </div>
  ) : null;
  const navigationResetHandoffTitle = navigationResetState
    ? navigationResetState.reason === "completed"
      ? "Route complete. Plan the next one."
      : "Navigation stopped. Plan the next route."
    : null;
  const navigationResetHandoffCopy = navigationResetState
    ? getNavigationResetHandoffCopy({
        reason: navigationResetState.reason,
        routeDistanceKm: navigationResetState.routeDistanceKm,
      })
    : null;
  const mapFooterOverlay = isNavigationActive ? (
    <div
      className="map-hud map-hud--navigation"
      data-testid="navigation-essential-hud"
    >
      <div className="map-hud__chips">
        {navigationSession?.routeStatus === "partial" ? (
          <span className="status-pill status-pill--warning">
            Partial route
          </span>
        ) : null}
        <span className={`status-pill ${navigationHudGpsStatusPill.className}`}>
          {navigationHudGpsStatusPill.label}
        </span>
      </div>
      <div className="map-hud__stats map-hud__stats--navigation">
        {navigationHudStats.map((stat) => (
          <div key={stat.label} className="preview-stat">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
    </div>
  ) : navigationResetState ? (
    <div
      className="map-hud map-hud--handoff"
      data-testid="navigation-reset-handoff"
    >
      <div className="map-hud__chips">
        {navigationResetState.routeStatus === "partial" ? (
          <span className="status-pill status-pill--warning">
            Partial route
          </span>
        ) : null}
        <span className="status-pill status-pill--active">
          {navigationResetState.reason === "completed"
            ? "Route complete"
            : "Route cleared"}
        </span>
        {navigationResetState.routeDistanceKm !== null ? (
          <span className="status-pill">
            {navigationResetState.routeDistanceKm.toFixed(2)} km
          </span>
        ) : null}
      </div>
      <div className="map-hud__headline">
        <strong>{navigationResetHandoffTitle}</strong>
        <span>{navigationResetHandoffCopy}</span>
      </div>
    </div>
  ) : routePreview?.summary ? (
    <div
      className="map-hud map-hud--preview"
      data-testid="route-preview-glance"
    >
      <div className="map-hud__chips">
        <span className="status-pill status-pill--active">
          {routeStatusLabels[routePreview.status]}
        </span>
        {routePreview.warnings.length > 0 ? (
          <span className="status-pill status-pill--warning">
            {routePreview.warnings.length} warning
            {routePreview.warnings.length === 1 ? "" : "s"}
          </span>
        ) : null}
        {isRoutePreviewStale ? (
          <span className="status-pill status-pill--warning">
            Needs refresh
          </span>
        ) : null}
      </div>
      <div className="map-hud__stats map-hud__stats--preview">
        <div className="preview-stat">
          <span>Distance</span>
          <strong>{routePreview.summary.totalDistanceKm.toFixed(2)} km</strong>
        </div>
        <div className="preview-stat">
          <span>Delta</span>
          <strong>
            {formatDistanceDelta(routePreview.summary.distanceDeltaMeters)}
          </strong>
        </div>
        <div className="preview-stat">
          <span>Elevation</span>
          <strong>
            {routePreview.summary.elevationGainMeters === null
              ? "Unknown"
              : `${Math.round(routePreview.summary.elevationGainMeters)} m`}
          </strong>
        </div>
      </div>
    </div>
  ) : null;
  const firstRoutePreviewWarning = routePreview?.warnings[0] ?? null;
  const failedRouteWarningDisplay =
    routePreview?.status === "failed" && firstRoutePreviewWarning
      ? getRouteWarningDisplay(firstRoutePreviewWarning)
      : null;
  const plannerPreviewInspector =
    !isNavigationActive && routePreview ? (
      <section className="form-section">
        <div className="section-heading">
          <h3>Current route</h3>
          <p>Inspect the current route here without covering the map.</p>
        </div>
        <div className="status-row">
          <span
            className={`status-pill${
              routePreview.status === "failed"
                ? " status-pill--error"
                : routePreview.status === "partial"
                  ? " status-pill--warning"
                  : " status-pill--active"
            }`}
          >
            {routeStatusLabels[routePreview.status]}
          </span>
          {routePreview.warnings.length > 0 ? (
            <span className="status-pill status-pill--warning">
              {routePreview.warnings.length} warning
              {routePreview.warnings.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {isRoutePreviewStale ? (
            <span className="status-pill status-pill--warning">
              Needs refresh
            </span>
          ) : null}
        </div>
        {routePreview.summary ? (
          <div className="preview-grid">
            <div className="preview-stat">
              <span>Distance</span>
              <strong>
                {routePreview.summary.totalDistanceKm.toFixed(2)} km
              </strong>
            </div>
            <div className="preview-stat">
              <span>Delta</span>
              <strong>
                {formatDistanceDelta(routePreview.summary.distanceDeltaMeters)}
              </strong>
            </div>
            <div className="preview-stat">
              <span>Elevation</span>
              <strong>
                {routePreview.summary.elevationGainMeters === null
                  ? "Unknown"
                  : routePreview.summary.elevationGainMeters
                    ? `${Math.round(routePreview.summary.elevationGainMeters)} m`
                    : "0 m"}
              </strong>
            </div>
          </div>
        ) : null}
        {routePreview.status !== "failed" && routePreview.summary ? (
          <div className="surface-summary">
            <div className="section-heading">
              <h3>Surface mix</h3>
              <p>{routeSurfaceSummaryMessage}</p>
            </div>
            <div className="surface-summary-grid">
              {routeSurfaceSummaryCards.map((card) => (
                <div key={card.id} className="surface-summary-card">
                  <span>{card.label}</span>
                  <strong>{card.valueText}</strong>
                  <div className="surface-summary-meter" aria-hidden="true">
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
        ) : null}
        {routePreview.status === "failed" ? (
          <p className="helper-copy helper-copy--warning">
            No supported round trip for the current start and settings.
          </p>
        ) : null}
        {routePreview.warnings.length > 0 ? (
          <ul className="warning-list">
            {routePreview.warnings.map((warning) => {
              const display = getRouteWarningDisplay(warning);

              return (
                <li key={`${warning.code}-${warning.message}`}>
                  <strong>{display.title}</strong>
                  <span>{display.body}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {isRoutePreviewStale ? (
          <p className="helper-copy helper-copy--warning">
            This preview is stale. Generate again to refresh the route line.
          </p>
        ) : null}
      </section>
    ) : null;
  const navigationSettingsDisclosure = (
    <details
      className="disclosure-card"
      data-testid="navigation-runtime-caveats"
    >
      <summary>Runtime and orientation</summary>
      <div className="disclosure-card__content navigation-runtime-caveats">
        <div className="section-heading">
          <h3>Navigation runtime mode</h3>
          <p>Choose fresher location updates or lower battery use.</p>
        </div>
        <div className="option-grid" data-testid="navigation-runtime-mode">
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
            Heading-up follows travel direction. North-up keeps the map fixed.
          </p>
        </div>
        <div className="option-grid" data-testid="navigation-orientation-mode">
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
    </details>
  );

  useEffect(() => {
    if (!navigationSession) {
      setNavigationSpeedBaseline(null);
      setNavigationProgressHintMeters(null);
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
    if (!navigationSession || !navigationSnapshot) {
      return;
    }

    setNavigationProgressHintMeters((current) => {
      const nextHintMeters = navigationSnapshot.isOffRoute
        ? (current ?? 0)
        : Math.max(current ?? 0, navigationSnapshot.completedDistanceMeters);

      if (current !== null && Math.abs(nextHintMeters - current) < 1) {
        return current;
      }

      return nextHintMeters;
    });
  }, [navigationSession, navigationSnapshot]);

  useEffect(() => {
    if (
      !navigationSession ||
      !navigationSnapshot ||
      !navigationHasFreshPosition ||
      navigationSnapshot.isOffRoute ||
      navigationSnapshot.remainingDistanceMeters >
        NAVIGATION_COMPLETE_THRESHOLD_METERS
    ) {
      return;
    }

    endNavigationSession("completed");
  }, [navigationHasFreshPosition, navigationSession, navigationSnapshot]);

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
    setIsPlannerDrawerOpen(false);

    if (isAwaitingPassThroughPoint) {
      setPassThroughPoints((current) => {
        return [
          ...current,
          createMapPassThroughPoint({
            coordinate,
            id: createPassThroughPointId("map"),
            index: current.length + 1,
          }),
        ];
      });
      setMapInteractionMode("idle");
      return;
    }

    if (startPointMode === "map_point") {
      setMapSelectedStart(createMapStartSelection(coordinate));
    }
  }

  function togglePassThroughPointSelection() {
    setMapInteractionMode((current) =>
      current === "add_pass_through" ? "idle" : "add_pass_through",
    );
    setIsPlannerDrawerOpen(false);
  }

  function closePlannerDrawer() {
    setIsPlannerDrawerOpen(false);
  }

  function togglePlannerDrawer() {
    setIsPlannerDrawerOpen((current) => !current);
  }

  function handlePlaceSearchQueryKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void requestPlaceSearch();
  }

  async function requestPlaceSearch() {
    const query = placeSearchQuery.trim();

    if (query.length < 2) {
      setPlaceSearchResponse(null);
      setPlaceSearchRequestError(
        "Enter at least two characters to search local places.",
      );
      return;
    }

    const nextRequestId = latestPlaceSearchRequestIdRef.current + 1;

    latestPlaceSearchRequestIdRef.current = nextRequestId;
    setPlaceSearchRequestError(null);
    setPlaceSearchResponse(null);
    setIsRequestingPlaceSearch(true);

    try {
      const searchResponse = await searchLocalPlaces({
        apiBaseUrl: webRuntimeConfig.apiBaseUrl,
        limit: DEFAULT_PLACE_SEARCH_LIMIT,
        query,
      });

      if (latestPlaceSearchRequestIdRef.current !== nextRequestId) {
        return;
      }

      setPlaceSearchResponse(searchResponse);
    } catch (error) {
      if (latestPlaceSearchRequestIdRef.current !== nextRequestId) {
        return;
      }

      setPlaceSearchRequestError(getPlaceSearchErrorMessage(error));
    } finally {
      if (latestPlaceSearchRequestIdRef.current === nextRequestId) {
        setIsRequestingPlaceSearch(false);
      }
    }
  }

  function applySearchResultAsStartPoint(result: PlaceSearchResult) {
    setMapInteractionMode("idle");
    setMapSelectedStart(createSearchStartSelection(result));
    setStartPointMode("map_point");
    setIsPlannerDrawerOpen(false);
  }

  function addSearchResultAsPassThroughPoint(result: PlaceSearchResult) {
    setMapInteractionMode("idle");
    setPassThroughPoints((current) => [
      ...current,
      createSearchPassThroughPoint({
        id: createPassThroughPointId("search"),
        result,
      }),
    ]);
    setIsPlannerDrawerOpen(false);
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

  function createPassThroughPointId(source: "map" | "search") {
    nextPassThroughPointIdRef.current += 1;

    return `${source}-waypoint-${nextPassThroughPointIdRef.current}`;
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
    setNavigationResetState(null);
    setIsPlannerDrawerOpen(false);
    void submitRoutePreviewRequest({
      candidateIndex: 1,
      randomSeed: null,
    });
  }

  function requestVariation() {
    const nextCandidateIndex = hasRoutePreview ? previewCandidateIndex + 1 : 1;

    setNavigationResetState(null);
    setIsPlannerDrawerOpen(false);
    void submitRoutePreviewRequest({
      candidateIndex: nextCandidateIndex,
      randomSeed: `draft-variation-${nextCandidateIndex}`,
    });
  }

  function startNavigation() {
    if (!canStartNavigation || !navigableRoutePreview) {
      return;
    }

    if (browserGeolocation.status !== "ready") {
      void requestNavigationGpsAccess();
    }

    setNavigationResetState(null);
    setIsPlannerDrawerOpen(false);
    setNavigationProgressHintMeters(0);
    setNavigationFollowMode("follow_position");
    setNavigationManualCenter(null);
    setNavigationSession({
      instructions: navigableRoutePreview.instructions ?? [],
      routeGeometry: navigableRoutePreview.geometry,
      routeDistanceKm: navigableRoutePreview.summary?.totalDistanceKm ?? null,
      routeId: navigableRoutePreview.routeId,
      routeStatus: navigableRoutePreview.status,
    });
  }

  function requestNavigationGpsAccess() {
    return requestSingleBrowserGeolocationFix({
      positionOptions: browserGeolocationPositionOptions,
    });
  }

  function endNavigationSession(reason: NavigationResetState["reason"]) {
    if (!navigationSession) {
      return;
    }

    setIsPlannerDrawerOpen(false);
    setNavigationFollowMode("follow_position");
    setNavigationManualCenter(null);
    setNavigationProgressHintMeters(null);
    setNavigationSpeedBaseline(null);
    setNavigationSession(null);
    setRoutePreview(null);
    setRoutePreviewRequestError(null);
    setIsRequestingRoutePreview(false);
    setLastSubmittedRequest(null);
    setPreviewCandidateIndex(1);
    setNavigationResetState({
      reason,
      routeDistanceKm: navigationSession.routeDistanceKm,
      routeStatus: navigationSession.routeStatus,
    });
  }

  function stopNavigation() {
    endNavigationSession("stopped");
  }

  function handlePlannerPrimaryAction() {
    if (isNavigationActive) {
      stopNavigation();
      return;
    }

    if (canStartNavigation) {
      startNavigation();
      return;
    }

    requestRoute();
  }

  function handlePlannerSecondaryAction() {
    if (isNavigationActive && navigationFollowActionLabel) {
      recenterNavigationMap();
      return;
    }

    if (canStartNavigation || hasVisibleRoutePreview) {
      requestVariation();
      return;
    }

    togglePassThroughPointSelection();
  }

  return (
    <main
      className={`planner-shell${
        isNavigationActive ? " planner-shell--navigation-active" : ""
      }`}
    >
      <section className="planner-header card">
        <div className="planner-header__copy">
          <p className="eyebrow">Pathbadger</p>
          <p className="planner-header__summary">
            Move the start on the map if needed, then generate a route.
          </p>
        </div>
        <div className="planner-header__meta">
          <div className="status-row">
            <span className="status-pill status-pill--active">Planning</span>
            <span
              className={`status-pill ${navigationHeroStatus.statusPillClassName}`}
            >
              {navigationHeroStatus.label}
            </span>
          </div>
          <p className="panel-copy">
            Route settings stay tucked away until you need them.
          </p>
        </div>
      </section>

      <section
        className={`planner-grid${
          isPlannerDrawerOpen ? " planner-grid--drawer-open" : ""
        }`}
      >
        <div
          className={`planner-drawer-backdrop${
            isPlannerDrawerOpen ? " planner-drawer-backdrop--visible" : ""
          }`}
          aria-hidden={isPlannerDrawerOpen ? "false" : "true"}
          onClick={closePlannerDrawer}
        />
        <form
          className="planner-panel card"
          onSubmit={(event) => event.preventDefault()}
        >
          {isNavigationActive ? (
            <>
              <div className="panel-heading">
                <div>
                  <p className="section-label">Navigation</p>
                  <h2>Navigation settings</h2>
                </div>
                <button
                  type="button"
                  className="button button--ghost planner-panel__close"
                  onClick={closePlannerDrawer}
                >
                  Close
                </button>
                <p className="panel-copy">
                  Open this only when you need to change how guidance behaves.
                </p>
              </div>
              <div className="status-row">
                {navigationSession?.routeStatus === "partial" ? (
                  <span className="status-pill status-pill--warning">
                    Partial route
                  </span>
                ) : null}
                <span className="status-pill status-pill--active">
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
              </div>
              <p
                className={`helper-copy ${
                  navigationSnapshot?.isOffRoute
                    ? "helper-copy--error"
                    : !navigationTrackedPosition ||
                        navigationHasLowConfidencePosition
                      ? "helper-copy--warning"
                      : "helper-copy--active"
                }`}
              >
                {navigationSettingsSupportCopy}
              </p>
              {navigationSettingsDisclosure}
              <div className="button-row">
                <button
                  type="button"
                  className="button button--secondary"
                  data-testid="finish-navigation-route"
                  onClick={() => endNavigationSession("completed")}
                >
                  Finish route
                </button>
              </div>
              {browserGeolocation.status !== "ready" &&
              browserGeolocation.status !== "unsupported" ? (
                <>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        void requestNavigationGpsAccess();
                      }}
                    >
                      {getNavigationGpsRequestActionLabel(browserGeolocation)}
                    </button>
                  </div>
                  <p className="helper-copy helper-copy--warning">
                    {getNavigationGpsRequestActionCopy(browserGeolocation)}
                  </p>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="panel-heading">
                <div>
                  <p className="section-label">Route settings</p>
                  <h2>Planning controls</h2>
                </div>
                <button
                  type="button"
                  className="button button--ghost planner-panel__close"
                  onClick={closePlannerDrawer}
                >
                  Close
                </button>
                <p className="panel-copy">
                  Change the start, distance, surface, or waypoints here.
                </p>
              </div>
              {plannerPreviewInspector}

              <fieldset className="form-fieldset" disabled={isNavigationActive}>
                <section className="form-section">
                  <div className="section-heading">
                    <h3>Start point</h3>
                    <p>Choose where the route should begin.</p>
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
                          startPointMode === mode
                            ? " option-card--selected"
                            : ""
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
                      {mapSelectedStart.source === "search" &&
                      mapSelectedStart.label ? (
                        <>
                          Search-selected start:{" "}
                          <strong>{mapSelectedStart.label}</strong> at{" "}
                          <code>
                            {formatCoordinate(mapSelectedStart.coordinate)}
                          </code>
                          . Click the planning map or choose another local
                          result to replace it.
                        </>
                      ) : mapSelectedStart.label ? (
                        <>
                          Default start:{" "}
                          <strong>{mapSelectedStart.label}</strong> at{" "}
                          <code>
                            {formatCoordinate(mapSelectedStart.coordinate)}
                          </code>
                          . Click the planning map to move it.
                        </>
                      ) : (
                        <>
                          Map-selected start:{" "}
                          <code>
                            {formatCoordinate(mapSelectedStart.coordinate)}
                          </code>
                          . Click the planning map to move it.
                        </>
                      )}
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
                    <h3>Local place search</h3>
                    <p>Find a nearby start or waypoint.</p>
                  </div>
                  <div className="status-row">
                    <span className="status-pill status-pill--active">
                      Local region
                    </span>
                    <span
                      className={`status-pill${
                        placeSearchStatusPillClassName
                          ? ` ${placeSearchStatusPillClassName}`
                          : ""
                      }`}
                      data-testid="place-search-status"
                    >
                      {placeSearchStatusLabel}
                    </span>
                  </div>
                  <div className="place-search-controls">
                    <label className="search-input">
                      <span>Place, street, or trailhead</span>
                      <input
                        type="search"
                        value={placeSearchQuery}
                        placeholder="Bad Bramstedt"
                        onChange={(event) =>
                          setPlaceSearchQuery(event.target.value)
                        }
                        onKeyDown={handlePlaceSearchQueryKeyDown}
                      />
                    </label>
                    <button
                      type="button"
                      className={`button ${
                        isRequestingPlaceSearch
                          ? "button--secondary"
                          : "button--primary"
                      }`}
                      onClick={() => {
                        void requestPlaceSearch();
                      }}
                    >
                      {isRequestingPlaceSearch
                        ? "Searching..."
                        : "Search places"}
                    </button>
                  </div>
                  <p className="helper-copy helper-copy--warning">
                    {getPlaceSearchRegionGuardrailCopy(
                      webRuntimeConfig.regionName,
                    )}
                  </p>
                  <p
                    className={`helper-copy${
                      placeSearchFeedbackClassName
                        ? ` ${placeSearchFeedbackClassName}`
                        : ""
                    }`}
                    data-testid="place-search-feedback"
                  >
                    {placeSearchFeedbackCopy}
                  </p>
                  {placeSearchResults.length > 0 ? (
                    <ul
                      className="search-results"
                      data-testid="place-search-results"
                    >
                      {placeSearchResults.map((result) => (
                        <li key={result.id} className="search-result-item">
                          <div>
                            <strong>{result.label}</strong>
                            <span>{formatCoordinate(result.coordinate)}</span>
                          </div>
                          <div className="search-result-actions">
                            <button
                              type="button"
                              className="mini-action"
                              onClick={() =>
                                applySearchResultAsStartPoint(result)
                              }
                            >
                              Use as start
                            </button>
                            <button
                              type="button"
                              className="mini-action"
                              onClick={() =>
                                addSearchResultAsPassThroughPoint(result)
                              }
                            >
                              Add pass-through
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>

                <section className="form-section">
                  <div className="section-heading">
                    <h3>Activity</h3>
                    <p>Match the route to how you plan to travel.</p>
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
                          surfacePreference === option
                            ? " segment--selected"
                            : ""
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
                    <p>Add a point the route must pass through.</p>
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
                      : "Use the map or a search result to anchor the route, then remove any point you no longer want."}
                  </p>
                  {passThroughPoints.length > 0 ? (
                    <ul className="pass-through-list">
                      {passThroughPoints.map((point) => (
                        <li key={point.id} className="pass-through-item">
                          <div>
                            <strong>{point.label}</strong>
                            <span>
                              {getPassThroughPointSourceCopy(point.source)} ·{" "}
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
                      No required pass-through points yet. Add one from the map
                      or a local place-search result when you want to anchor the
                      route.
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
                      ? "Generating a route now."
                      : isCurrentPositionPendingRouteGeneration
                        ? getCurrentPositionRouteBlockingMessage(
                            browserGeolocation,
                          )
                        : routePreviewRequestError
                          ? routePreviewRequestError
                          : isRoutePreviewStale
                            ? "The plan changed. Generate again to refresh the route."
                            : hasFailedRoutePreview
                              ? "No supported round trip for these settings yet."
                              : hasVisibleRoutePreview
                                ? "The current preview is on the map. Generate a variation for another option."
                                : "Generate a route from the current plan."}
                  </p>
                </section>
              </fieldset>
            </>
          )}
        </form>

        <section
          className={`preview-column${
            isNavigationActive ? " preview-column--navigation-active" : ""
          }`}
        >
          <article
            className={`card preview-card${
              isNavigationActive ? " preview-card--navigation-active" : ""
            }`}
          >
            {!isNavigationActive ? (
              <div className="panel-heading">
                <div>
                  <p className="section-label">Map first</p>
                  <h2>Plan on the map</h2>
                </div>
                <div className="status-row">
                  {plannerStagePills.map((pill) => (
                    <span
                      key={pill.label}
                      className={`status-pill${pill.className ? ` ${pill.className}` : ""}`}
                    >
                      {pill.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {!isNavigationActive ? (
              plannerJourneyCopy ? (
                <p className="panel-copy panel-copy--planner-lead">
                  {plannerJourneyCopy}
                </p>
              ) : null
            ) : null}

            <div className="planner-map-stage">
              <div
                className={`planner-map-toolbar${
                  isNavigationActive ? " planner-map-toolbar--navigation" : ""
                }`}
              >
                <div className="planner-map-toolbar__utility-row">
                  <button
                    type="button"
                    className="button button--ghost planner-drawer-toggle"
                    onClick={togglePlannerDrawer}
                  >
                    {plannerDrawerToggleLabel}
                  </button>
                  {!isNavigationActive ? (
                    <button
                      type="button"
                      className="button button--ghost planner-map-toolbar__utility-button"
                      onClick={togglePassThroughPointSelection}
                    >
                      {plannerWaypointActionLabel}
                    </button>
                  ) : null}
                </div>
                <div className="planner-map-toolbar__primary-actions">
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={plannerPrimaryActionDisabled}
                    onClick={handlePlannerPrimaryAction}
                  >
                    {plannerPrimaryActionDisplayLabel}
                  </button>
                  {plannerSecondaryActionDisplayLabel ? (
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={isRequestingRoutePreview}
                      onClick={handlePlannerSecondaryAction}
                    >
                      {plannerSecondaryActionDisplayLabel}
                    </button>
                  ) : null}
                </div>
                <div className="status-row planner-map-toolbar__meta">
                  <span className="status-pill status-pill--active">
                    {getPlannerStartPointStatusLabel({
                      mapSelectedStart,
                      startPoint,
                      startPointMode,
                    })}
                  </span>
                  <span className="status-pill">
                    {passThroughPoints.length === 0
                      ? "No waypoints"
                      : `${passThroughPoints.length} waypoint${
                          passThroughPoints.length === 1 ? "" : "s"
                        }`}
                  </span>
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
                headerOverlay={navigationMapHeaderOverlay}
                isMapStartActive={
                  !isNavigationActive && startPointMode === "map_point"
                }
                isNavigationActive={isNavigationActive}
                interactionMode={
                  isNavigationActive ? "idle" : mapInteractionMode
                }
                navigationFollowMode={
                  isNavigationActive ? navigationFollowMode : null
                }
                navigationBearingDegrees={
                  isNavigationActive
                    ? navigationOrientationState.appliedBearingDegrees
                    : 0
                }
                navigationHasFreshPosition={navigationHasFreshPosition}
                navigationIsHeadingUpActive={
                  navigationOrientationState.isHeadingUpActive
                }
                navigationIsOffRoute={navigationSnapshot?.isOffRoute ?? false}
                navigationOrientationLabel={
                  isNavigationActive
                    ? navigationOrientationState.indicatorLabel
                    : "North up"
                }
                navigationProgressFraction={
                  navigationSnapshot?.progressFraction ?? null
                }
                navigationSpeedKmh={
                  navigationSpeedMetrics?.currentSpeedKmh ?? null
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
                footerOverlay={mapFooterOverlay}
              />
            </div>

            {!isNavigationActive && routePreviewRequestError ? (
              <div className="response-banner response-banner--error">
                <strong>Preview request failed.</strong>
                <span>{routePreviewRequestError}</span>
              </div>
            ) : null}

            {!isNavigationActive && isRequestingRoutePreview ? (
              <div className="response-banner response-banner--pending">
                <strong>Generating route.</strong>
                <span>
                  Generating a route now. Review it on the map when it arrives.
                </span>
              </div>
            ) : null}

            {!isNavigationActive && routePreview?.status === "failed" ? (
              <div className="response-banner response-banner--error">
                <strong>
                  {failedRouteWarningDisplay?.title ??
                    "Route unavailable right now."}
                </strong>
                <span>
                  {failedRouteWarningDisplay?.body ??
                    "Change the start, distance, surface, or waypoints and try again."}
                </span>
              </div>
            ) : null}
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

function toSentenceCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
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

function getNavigationResetHandoffCopy(options: {
  reason: NavigationResetState["reason"];
  routeDistanceKm: number | null;
}) {
  const routeDistanceCopy =
    options.routeDistanceKm === null
      ? "The last route"
      : `The last ${options.routeDistanceKm.toFixed(2)} km route`;

  if (options.reason === "completed") {
    return `${routeDistanceCopy} is cleared from the map. Generate the next route or adjust the plan before you head out again.`;
  }

  return `${routeDistanceCopy} is cleared from the map so you can plan the next route immediately without stale guidance chrome in the way.`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Route preview request failed before the planner received a usable response.";
}

function getPlaceSearchErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Local place search failed before the planner received a usable response.";
}

function getPlaceSearchStatusLabel(options: {
  errorMessage: string | null;
  isLoading: boolean;
  response: PlaceSearchResponse | null;
}) {
  if (options.errorMessage) {
    return "Search request failed";
  }

  if (options.isLoading) {
    return "Searching local places";
  }

  if (!options.response) {
    return "Search ready";
  }

  switch (options.response.status) {
    case "success":
      return "Matches ready";
    case "empty":
      return "No local matches";
    case "unavailable":
      return "Local search unavailable";
  }
}

function getPlaceSearchStatusPillClassName(options: {
  errorMessage: string | null;
  isLoading: boolean;
  response: PlaceSearchResponse | null;
}) {
  if (options.errorMessage) {
    return "status-pill--error";
  }

  if (options.isLoading) {
    return "status-pill--warning";
  }

  if (!options.response) {
    return "status-pill--active";
  }

  switch (options.response.status) {
    case "success":
      return "status-pill--active";
    case "empty":
      return "status-pill--warning";
    case "unavailable":
      return "status-pill--warning";
  }
}

function getPlannerJourneyCopy(options: {
  browserGeolocation: BrowserGeolocationState;
  canStartNavigation: boolean;
  hasFailedRoutePreview: boolean;
  hasVisibleRoutePreview: boolean;
  isCurrentPositionPendingRouteGeneration: boolean;
  isNavigationActive: boolean;
  isRequestingRoutePreview: boolean;
  isRoutePreviewStale: boolean;
  navigationResetState: NavigationResetState | null;
  routePreviewRequestError: string | null;
}) {
  if (options.isNavigationActive) {
    return null;
  }

  if (options.navigationResetState) {
    return getNavigationResetHandoffCopy({
      reason: options.navigationResetState.reason,
      routeDistanceKm: options.navigationResetState.routeDistanceKm,
    });
  }

  if (options.canStartNavigation || options.hasVisibleRoutePreview) {
    return null;
  }

  if (options.isRequestingRoutePreview) {
    return "Generating a route now.";
  }

  if (options.routePreviewRequestError || options.hasFailedRoutePreview) {
    return null;
  }

  if (options.isCurrentPositionPendingRouteGeneration) {
    return getCurrentPositionRouteBlockingMessage(options.browserGeolocation);
  }

  if (options.isRoutePreviewStale) {
    return "The plan changed. Refresh the route.";
  }

  return "Move the start on the map if needed, then generate a route.";
}

function getPlannerPrimaryActionLabel(options: {
  canStartNavigation: boolean;
  hasVisibleRoutePreview: boolean;
  isCurrentPositionPendingRouteGeneration: boolean;
  isNavigationActive: boolean;
  isRequestingRoutePreview: boolean;
  isRoutePreviewStale: boolean;
}) {
  if (options.isNavigationActive) {
    return "Stop navigation";
  }

  if (options.canStartNavigation) {
    return "Start navigation";
  }

  if (options.isRequestingRoutePreview) {
    return "Generating route...";
  }

  if (options.isCurrentPositionPendingRouteGeneration) {
    return "Waiting for GPS";
  }

  if (options.isRoutePreviewStale) {
    return "Refresh route";
  }

  if (options.hasVisibleRoutePreview) {
    return "Generate another route";
  }

  return "Generate route";
}

function getPlannerSecondaryActionLabel(options: {
  canStartNavigation: boolean;
  hasVisibleRoutePreview: boolean;
  isAwaitingPassThroughPoint: boolean;
  isNavigationActive: boolean;
  navigationFollowActionLabel: string | null;
}) {
  if (options.isNavigationActive) {
    return options.navigationFollowActionLabel;
  }

  if (options.canStartNavigation || options.hasVisibleRoutePreview) {
    return "Generate variation";
  }

  return null;
}

function getPlannerStartPointStatusLabel(options: {
  mapSelectedStart: PlannerMapStartSelection;
  startPoint: StartPointOption;
  startPointMode: StartPointMode;
}) {
  switch (options.startPointMode) {
    case "current_position":
      return "GPS start";
    case "saved_default":
      return "Default start";
    case "last_used":
      return "Last used start";
    case "map_point":
    default:
      if (options.mapSelectedStart.source === "search") {
        return "Search start";
      }

      if (options.mapSelectedStart.label) {
        return "Home start";
      }

      return options.startPoint.label;
  }
}

function getPlannerStagePills(options: {
  canStartNavigation: boolean;
  hasFailedRoutePreview: boolean;
  hasVisibleRoutePreview: boolean;
  isAwaitingPassThroughPoint: boolean;
  isNavigationActive: boolean;
  isRequestingRoutePreview: boolean;
  isRoutePreviewStale: boolean;
  passThroughPointCount: number;
  startPointLabel: string;
}) {
  return [
    {
      label: options.startPointLabel,
      className: "status-pill--active",
    },
    {
      label: options.isAwaitingPassThroughPoint
        ? `Tap map for waypoint ${options.passThroughPointCount + 1}`
        : options.passThroughPointCount === 0
          ? "No waypoints"
          : `${options.passThroughPointCount} waypoint${
              options.passThroughPointCount === 1 ? "" : "s"
            }`,
      className: options.isAwaitingPassThroughPoint
        ? "status-pill--warning"
        : "",
    },
    {
      label: options.isNavigationActive
        ? "Navigation live"
        : options.canStartNavigation
          ? "Ready to start"
          : options.isRequestingRoutePreview
            ? "Generating preview"
            : options.isRoutePreviewStale
              ? "Preview out of date"
              : options.hasFailedRoutePreview
                ? "Route unavailable"
                : options.hasVisibleRoutePreview
                  ? "Preview on map"
                  : "No route yet",
      className:
        options.isNavigationActive || options.canStartNavigation
          ? "status-pill--active"
          : options.isRequestingRoutePreview ||
              options.isRoutePreviewStale ||
              options.hasFailedRoutePreview
            ? "status-pill--warning"
            : "",
    },
  ];
}

function getRouteWarningDisplay(
  warning: RouteGenerateResponse["warnings"][number],
) {
  switch (warning.code) {
    case "routing_engine_unavailable":
      return {
        title: "Route generation unavailable",
        body: "Pathbadger could not generate a route right now. Try again in a moment.",
      };
    case "route_exceeds_supported_distance_limit":
      return {
        title: "Distance target unavailable",
        body: "No supported round course could stay close enough to the requested distance. Try a different distance or generate another variation.",
      };
    case "route_cannot_meet_requested_constraints":
      return {
        title: "Route constraints too tight",
        body: warning.message,
      };
    case "routing_engine_invalid_response":
      return {
        title: "Route generation interrupted",
        body: "Pathbadger received an unusable route response. Try generating the route again.",
      };
    default:
      return {
        title: toSentenceCase(warning.code.replaceAll("_", " ")),
        body: warning.message.replaceAll("GraphHopper", "the route generator"),
      };
  }
}

function createDefaultMapStartSelection(): PlannerMapStartSelection {
  return {
    coordinate: DEFAULT_MAP_SELECTED_START_COORDINATE,
    label: DEFAULT_MAP_SELECTED_START_LABEL,
    source: "map",
  };
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

function getNavigationWaitingGpsStatusPill(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "denied":
      return {
        className: "status-pill--error",
        label: "Permission denied",
      };
    case "unsupported":
      return {
        className: "status-pill--error",
        label: "GPS unsupported",
      };
    case "unavailable":
      return {
        className: "status-pill--warning",
        label: "GPS unavailable",
      };
    case "idle":
      return {
        className: "",
        label: "GPS idle",
      };
    case "requesting":
    case "ready":
    default:
      return {
        className: "status-pill--warning",
        label: "Waiting for GPS",
      };
  }
}

function getNavigationWaitingGpsManeuverTitle(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "denied":
      return "Browser location blocked";
    case "unsupported":
      return "Browser GPS unsupported";
    case "unavailable":
      return "Waiting for GPS fix";
    case "idle":
    case "requesting":
    case "ready":
    default:
      return "Waiting for browser GPS";
  }
}

function getNavigationWaitingGpsManeuverDistanceLabel(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "denied":
      return "Allow location in browser";
    case "unsupported":
      return "Unsupported";
    case "unavailable":
      return "Waiting for fix";
    case "idle":
    case "requesting":
    case "ready":
    default:
      return "Waiting for GPS";
  }
}

function getNavigationGpsRequestActionLabel(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "denied":
      return "Retry GPS after allowing location";
    case "unavailable":
      return "Retry GPS fix";
    case "idle":
      return "Request GPS access";
    case "requesting":
    case "ready":
    case "unsupported":
    default:
      return "Request GPS access again";
  }
}

function getNavigationGpsRequestActionCopy(
  browserGeolocation: BrowserGeolocationState,
) {
  switch (browserGeolocation.status) {
    case "denied":
      return "If Arc was blocked earlier, change this localhost tab to Allow for Location in site settings, then retry here.";
    case "unavailable":
      return "Permission is already available, but the browser has not produced a usable fix yet. Retry once the device location is ready.";
    case "idle":
      return "Use this to request browser GPS explicitly while staying on the active navigation screen.";
    case "requesting":
      return "Use this if Arc did not surface the location prompt from the first request.";
    case "ready":
    case "unsupported":
    default:
      return "Use this to request browser GPS again.";
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

function getNavigationInstructionSymbol(instruction: RouteInstruction | null) {
  switch (instruction?.type) {
    case "turn_left":
    case "turn_sharp_left":
      return "\u2190";
    case "turn_right":
    case "turn_sharp_right":
      return "\u2192";
    case "turn_slight_left":
      return "\u2196";
    case "turn_slight_right":
      return "\u2197";
    case "u_turn_left":
    case "u_turn_right":
      return "\u21b6";
    case "arrive":
      return "\u25a0";
    case "depart":
    case "continue":
    case "via":
    default:
      return "\u2191";
  }
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
