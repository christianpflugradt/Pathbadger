import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  Coordinate,
  RouteGeometry,
  RouteStatus,
} from "@pathbadger/shared";
import maplibregl from "maplibre-gl";

import { getNavigationMapCameraState } from "./navigation-map-camera";
import type { NavigationFollowMode } from "./navigation-follow-state";
import {
  getMapErrorMessage,
  getNextPlanningMapLoadStateOnError,
  type MapLoadState,
} from "./planning-map-runtime";

import "maplibre-gl/dist/maplibre-gl.css";

type PlanningMapProps = {
  center: Coordinate;
  centerLabel: string;
  currentPosition: Coordinate | null;
  currentPositionLabel: string | null;
  headerOverlay?: ReactNode;
  isMapStartActive: boolean;
  isNavigationActive: boolean;
  interactionMode: "idle" | "add_pass_through";
  navigationBearingDegrees: number;
  navigationFollowMode: NavigationFollowMode | null;
  navigationHasFreshPosition: boolean;
  navigationIsHeadingUpActive: boolean;
  navigationIsOffRoute: boolean;
  navigationOrientationLabel: string;
  navigationProgressFraction: number | null;
  navigationSpeedKmh: number | null;
  onNavigationManualPan: (center: Coordinate) => void;
  onMapSelect: (coordinate: Coordinate) => void;
  onNavigationViewportChange: (center: Coordinate) => void;
  passThroughPoints: Array<{ coordinate: Coordinate; label: string }>;
  footerOverlay?: ReactNode;
  regionName: string;
  routeGeometry: RouteGeometry | null;
  routeStatus: RouteStatus | null;
  startPoint: Coordinate;
  startPointLabel: string;
  styleUrl: string;
};

const DEFAULT_ZOOM = 11.5;
const ROUTE_PREVIEW_SOURCE_ID = "route-preview";
const ROUTE_PREVIEW_CASING_LAYER_ID = "route-preview-casing";
const ROUTE_PREVIEW_LINE_LAYER_ID = "route-preview-line";
const ROUTE_PREVIEW_COMPLETED_COLOR = "rgba(247, 244, 234, 0.3)";
const ROUTE_PREVIEW_SUCCESS_COLOR = "#6b7a34";
const ROUTE_PREVIEW_PARTIAL_COLOR = "#c98a2d";

export function PlanningMap({
  center,
  centerLabel,
  currentPosition,
  currentPositionLabel,
  headerOverlay,
  isMapStartActive,
  isNavigationActive,
  interactionMode,
  navigationBearingDegrees,
  navigationFollowMode,
  navigationHasFreshPosition,
  navigationIsHeadingUpActive,
  navigationIsOffRoute,
  navigationOrientationLabel,
  navigationProgressFraction,
  navigationSpeedKmh,
  onNavigationManualPan,
  onMapSelect,
  onNavigationViewportChange,
  passThroughPoints,
  footerOverlay,
  regionName,
  routeGeometry,
  routeStatus,
  startPoint,
  startPointLabel,
  styleUrl,
}: PlanningMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialCenterRef = useRef(center);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [loadState, setLoadState] = useState<MapLoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!styleUrl.trim()) {
      setLoadState("error");
      setErrorMessage(
        "PUBLIC_TILE_STYLE_URL is empty. Configure a self-hosted style document before the map can load.",
      );
      return;
    }

    setLoadState("loading");
    setErrorMessage(null);

    const map = new maplibregl.Map({
      attributionControl: { compact: true },
      center: [initialCenterRef.current.lon, initialCenterRef.current.lat],
      container,
      style: styleUrl,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      }),
      "top-right",
    );
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    const handleLoad = () => {
      ensureRoutePreviewLayers(map);
      setLoadState("ready");
      setErrorMessage(null);
    };
    const handleError = (event: { error?: unknown }) => {
      setLoadState((current) => getNextPlanningMapLoadStateOnError(current));
      setErrorMessage(
        (current) => current ?? getMapErrorMessage(event.error, styleUrl),
      );
    };

    map.on("load", handleLoad);
    map.on("error", handleError);
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (isNavigationActive && navigationFollowMode === "manual_pan") {
      return;
    }

    if (isNavigationActive) {
      const cameraState = getNavigationMapCameraState({
        currentSpeedKmh: navigationSpeedKmh,
        hasFreshPosition: navigationHasFreshPosition,
        isHeadingUpActive: navigationIsHeadingUpActive,
        isOffRoute: navigationIsOffRoute,
        viewportHeight: map.getContainer().clientHeight,
        viewportWidth: map.getContainer().clientWidth,
      });

      map.easeTo({
        bearing: navigationBearingDegrees,
        center: [center.lon, center.lat],
        duration: cameraState.transitionDurationMs,
        padding: cameraState.padding,
        pitch: cameraState.pitchDegrees,
        zoom: cameraState.zoomLevel,
      });

      return;
    }

    map.easeTo({
      bearing: 0,
      center: [center.lon, center.lat],
      duration: 0,
      padding: zeroPadding(),
      pitch: 0,
      zoom: map.getZoom() || DEFAULT_ZOOM,
    });
  }, [
    center.lat,
    center.lon,
    isNavigationActive,
    navigationBearingDegrees,
    navigationFollowMode,
    navigationHasFreshPosition,
    navigationIsHeadingUpActive,
    navigationIsOffRoute,
    navigationSpeedKmh,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      onMapSelect({
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      });
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [onMapSelect, styleUrl]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const cursor = isNavigationActive
      ? "grab"
      : interactionMode === "add_pass_through" || isMapStartActive
        ? "crosshair"
        : "grab";

    map.getCanvas().style.cursor = cursor;

    return () => {
      map.getCanvas().style.cursor = "";
    };
  }, [interactionMode, isMapStartActive, isNavigationActive, styleUrl]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isNavigationActive) {
      return;
    }

    const handleDragStart = () => {
      onNavigationManualPan(getCoordinateFromLngLat(map.getCenter()));
    };
    const handleDragEnd = () => {
      onNavigationViewportChange(getCoordinateFromLngLat(map.getCenter()));
    };

    map.on("dragstart", handleDragStart);
    map.on("dragend", handleDragEnd);

    return () => {
      map.off("dragstart", handleDragStart);
      map.off("dragend", handleDragEnd);
    };
  }, [
    isNavigationActive,
    onNavigationManualPan,
    onNavigationViewportChange,
    styleUrl,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());

    const nextMarkers = [
      new maplibregl.Marker({
        anchor: "bottom",
        element: createMarkerElement("start", "S", startPointLabel),
      })
        .setLngLat([startPoint.lon, startPoint.lat])
        .addTo(map),
      ...passThroughPoints.map((point, index) =>
        new maplibregl.Marker({
          anchor: "bottom",
          element: createMarkerElement(
            "waypoint",
            String(index + 1),
            point.label,
          ),
        })
          .setLngLat([point.coordinate.lon, point.coordinate.lat])
          .addTo(map),
      ),
      ...(currentPosition
        ? [
            new maplibregl.Marker({
              anchor: "center",
              element: createMarkerElement(
                "current",
                "N",
                currentPositionLabel ?? "Current position",
              ),
            })
              .setLngLat([currentPosition.lon, currentPosition.lat])
              .addTo(map),
          ]
        : []),
    ];

    markersRef.current = nextMarkers;

    return () => {
      nextMarkers.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [
    currentPosition,
    currentPositionLabel,
    passThroughPoints,
    startPoint,
    startPointLabel,
    styleUrl,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || loadState !== "ready") {
      return;
    }

    ensureRoutePreviewLayers(map);
    syncRoutePreview(map, routeGeometry, routeStatus, {
      isNavigationActive,
      navigationProgressFraction,
    });

    if (!isNavigationActive && routeGeometry?.coordinates.length) {
      fitMapToRoutePreview(map, routeGeometry);
    }
  }, [
    isNavigationActive,
    loadState,
    navigationProgressFraction,
    routeGeometry,
    routeStatus,
    styleUrl,
  ]);

  const isAwaitingPassThroughPoint = interactionMode === "add_pass_through";
  const interactionLabel = isAwaitingPassThroughPoint
    ? "Add pass-through"
    : isNavigationActive
      ? navigationFollowMode === "manual_pan"
        ? "Manual map view"
        : "Follow current position"
      : isMapStartActive
        ? "Move start point"
        : "Preview only";
  const statusHeading =
    loadState === "error"
      ? "Self-hosted map unavailable"
      : isNavigationActive
        ? "Navigation session is live"
        : isAwaitingPassThroughPoint
          ? "Click map to add a pass-through point"
          : isMapStartActive
            ? "Click map to move the start point"
            : routeGeometry
              ? "Routed preview is rendered"
              : loadState === "ready"
                ? "Planning map is live"
                : "Loading self-hosted map";
  const statusEyebrow =
    loadState === "error"
      ? "Map status"
      : isNavigationActive
        ? "Navigation"
        : routeGeometry
          ? "Route preview"
          : "Planning map";
  const statusBody =
    loadState === "error"
      ? errorMessage
      : isNavigationActive
        ? routeGeometry
          ? navigationFollowMode === "manual_pan"
            ? "Map follow is paused after a manual pan. Recenter when you want the live position centered again."
            : "Live route-following mode is active."
          : "Navigation mode is active, but the current route geometry is unavailable."
        : isAwaitingPassThroughPoint
          ? `Tap the map to add pass-through point ${passThroughPoints.length + 1}.`
          : isMapStartActive
            ? "Tap the map to move the start point."
            : routeGeometry
              ? "The generated route is visible on the map."
              : loadState === "ready"
                ? "Open route settings only when you need them."
                : "Connecting to the configured style document before route overlays and point selection are added.";
  const statusChips =
    loadState === "error"
      ? [
          regionName,
          centerLabel,
          formatCoordinate(center),
          getStyleLabel(styleUrl),
        ]
      : isNavigationActive
        ? [
            interactionLabel,
            navigationFollowMode === "manual_pan"
              ? "Follow paused"
              : "Following position",
            navigationOrientationLabel,
            `${passThroughPoints.length} waypoint${
              passThroughPoints.length === 1 ? "" : "s"
            }`,
          ]
        : [
            interactionLabel,
            `${passThroughPoints.length} waypoint${
              passThroughPoints.length === 1 ? "" : "s"
            }`,
            routeGeometry ? "Route line visible" : "No route line",
          ];
  const shouldShowStatusOverlay = loadState !== "ready";

  return (
    <section
      className={`planning-map planning-map--${loadState}`}
      aria-label="Planning map"
      data-map-center={formatCoordinate(center)}
      data-map-load-state={loadState}
      data-navigation-bearing={String(navigationBearingDegrees)}
      data-navigation-follow-mode={
        isNavigationActive
          ? (navigationFollowMode ?? "follow_position")
          : "inactive"
      }
      data-navigation-orientation={
        isNavigationActive ? navigationOrientationLabel : "inactive"
      }
      data-navigation-camera-mode={
        isNavigationActive
          ? navigationFollowMode === "manual_pan"
            ? "manual_pan"
            : "forward_follow"
          : "planning"
      }
      data-map-style-url={getStyleLabel(styleUrl)}
      data-testid="planning-map"
    >
      <div ref={containerRef} className="planning-map__canvas" />
      {shouldShowStatusOverlay ? (
        <div className="planning-map__status" role="status" aria-live="polite">
          <p className="map-label">{statusEyebrow}</p>
          <h3 data-testid="planning-map-heading">{statusHeading}</h3>
          <p data-testid="planning-map-body">{statusBody}</p>
          <div className="planning-map__chips">
            {statusChips.map((chip) => (
              <span key={chip} className="planning-map__chip">
                {chip}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {headerOverlay ? (
        <div className="planning-map__header-overlay">{headerOverlay}</div>
      ) : null}
      {footerOverlay ? (
        <div className="planning-map__footer-overlay">{footerOverlay}</div>
      ) : null}
    </section>
  );
}

function formatCoordinate(coordinate: Coordinate) {
  return `${coordinate.lat.toFixed(4)}, ${coordinate.lon.toFixed(4)}`;
}

function getCoordinateFromLngLat(lngLat: maplibregl.LngLat) {
  return {
    lat: lngLat.lat,
    lon: lngLat.lng,
  };
}

function createMarkerElement(
  kind: "current" | "start" | "waypoint",
  text: string,
  title: string,
) {
  const element = document.createElement("div");

  element.className = `planning-marker planning-marker--${kind}`;
  element.textContent = text;
  element.title = title;
  element.setAttribute("aria-hidden", "true");

  return element;
}

function ensureRoutePreviewLayers(map: maplibregl.Map) {
  if (!map.getSource(ROUTE_PREVIEW_SOURCE_ID)) {
    map.addSource(ROUTE_PREVIEW_SOURCE_ID, {
      type: "geojson",
      data: emptyRoutePreviewCollection(),
      lineMetrics: true,
    });
  }

  if (!map.getLayer(ROUTE_PREVIEW_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_PREVIEW_CASING_LAYER_ID,
      type: "line",
      source: ROUTE_PREVIEW_SOURCE_ID,
      paint: {
        "line-color": "rgba(20, 33, 61, 0.92)",
        "line-opacity": 0.52,
        "line-width": 9,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }

  if (!map.getLayer(ROUTE_PREVIEW_LINE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_PREVIEW_LINE_LAYER_ID,
      type: "line",
      source: ROUTE_PREVIEW_SOURCE_ID,
      paint: {
        "line-gradient": buildUniformRouteGradient(
          ROUTE_PREVIEW_SUCCESS_COLOR,
        ) as never,
        "line-width": 5.4,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }
}

function syncRoutePreview(
  map: maplibregl.Map,
  routeGeometry: RouteGeometry | null,
  routeStatus: RouteStatus | null,
  options: {
    isNavigationActive: boolean;
    navigationProgressFraction: number | null;
  },
) {
  const source = map.getSource(ROUTE_PREVIEW_SOURCE_ID) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (!source) {
    return;
  }

  source.setData(
    routeGeometry
      ? {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: routeGeometry,
              properties: {},
            },
          ],
        }
      : emptyRoutePreviewCollection(),
  );

  const activeRouteColor =
    routeStatus === "partial"
      ? ROUTE_PREVIEW_PARTIAL_COLOR
      : ROUTE_PREVIEW_SUCCESS_COLOR;

  map.setPaintProperty(
    ROUTE_PREVIEW_LINE_LAYER_ID,
    "line-gradient",
    options.isNavigationActive
      ? buildNavigationRouteGradient({
          activeRouteColor,
          progressFraction: options.navigationProgressFraction,
        })
      : (buildUniformRouteGradient(activeRouteColor) as never),
  );
}

function fitMapToRoutePreview(
  map: maplibregl.Map,
  routeGeometry: RouteGeometry,
) {
  const [firstCoordinate] = routeGeometry.coordinates;

  if (!firstCoordinate) {
    return;
  }

  const bounds = routeGeometry.coordinates.reduce(
    (currentBounds, [lon, lat]) => currentBounds.extend([lon, lat]),
    new maplibregl.LngLatBounds(firstCoordinate, firstCoordinate),
  );

  map.fitBounds(bounds, {
    padding: 72,
    duration: 0,
    maxZoom: 13,
  });
}

function emptyRoutePreviewCollection() {
  return {
    type: "FeatureCollection" as const,
    features: [],
  };
}

function zeroPadding() {
  return {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  };
}

function buildUniformRouteGradient(color: string) {
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    color,
    1,
    color,
  ] as const;
}

function buildNavigationRouteGradient(options: {
  activeRouteColor: string;
  progressFraction: number | null;
}) {
  const progressFraction =
    options.progressFraction === null
      ? null
      : clamp(options.progressFraction, 0, 1);

  if (progressFraction === null || progressFraction <= 0.002) {
    return buildUniformRouteGradient(options.activeRouteColor);
  }

  if (progressFraction >= 0.998) {
    return buildUniformRouteGradient(ROUTE_PREVIEW_COMPLETED_COLOR);
  }

  const gradientEdgeStart = Math.max(progressFraction - 0.0015, 0);
  const gradientEdgeEnd = Math.min(progressFraction + 0.0015, 1);

  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    ROUTE_PREVIEW_COMPLETED_COLOR,
    gradientEdgeStart,
    ROUTE_PREVIEW_COMPLETED_COLOR,
    gradientEdgeEnd,
    options.activeRouteColor,
    1,
    options.activeRouteColor,
  ] as const;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function trimStyleUrl(styleUrl: string) {
  try {
    const { origin, pathname } = new URL(styleUrl);

    return `${origin}${pathname}`;
  } catch {
    return styleUrl;
  }
}

function getStyleLabel(styleUrl: string) {
  return trimStyleUrl(styleUrl);
}
