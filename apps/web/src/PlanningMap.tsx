import { useEffect, useRef, useState } from "react";
import type {
  Coordinate,
  RouteGeometry,
  RouteStatus,
} from "@pathbadger/shared";
import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

type PlanningMapProps = {
  center: Coordinate;
  centerLabel: string;
  isMapStartActive: boolean;
  interactionMode: "idle" | "add_pass_through";
  onMapSelect: (coordinate: Coordinate) => void;
  passThroughPoints: Array<{ coordinate: Coordinate; label: string }>;
  regionName: string;
  routeGeometry: RouteGeometry | null;
  routeStatus: RouteStatus | null;
  styleUrl: string;
};

type MapLoadState = "loading" | "ready" | "error";

const DEFAULT_ZOOM = 11.5;
const ROUTE_PREVIEW_SOURCE_ID = "route-preview";
const ROUTE_PREVIEW_CASING_LAYER_ID = "route-preview-casing";
const ROUTE_PREVIEW_LINE_LAYER_ID = "route-preview-line";

export function PlanningMap({
  center,
  centerLabel,
  isMapStartActive,
  interactionMode,
  onMapSelect,
  passThroughPoints,
  regionName,
  routeGeometry,
  routeStatus,
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
      setLoadState((current) => (current === "ready" ? current : "error"));
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

    map.easeTo({
      center: [center.lon, center.lat],
      duration: 0,
      zoom: map.getZoom() || DEFAULT_ZOOM,
    });
  }, [center.lat, center.lon]);

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

    const cursor =
      interactionMode === "add_pass_through" || isMapStartActive
        ? "crosshair"
        : "grab";

    map.getCanvas().style.cursor = cursor;

    return () => {
      map.getCanvas().style.cursor = "";
    };
  }, [interactionMode, isMapStartActive, styleUrl]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());

    const nextMarkers = [
      new maplibregl.Marker({
        anchor: "bottom",
        element: createMarkerElement("start", "S", centerLabel),
      })
        .setLngLat([center.lon, center.lat])
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
    ];

    markersRef.current = nextMarkers;

    return () => {
      nextMarkers.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [center, centerLabel, passThroughPoints, styleUrl]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || loadState !== "ready") {
      return;
    }

    ensureRoutePreviewLayers(map);
    syncRoutePreview(map, routeGeometry, routeStatus);

    if (routeGeometry?.coordinates.length) {
      fitMapToRoutePreview(map, routeGeometry);
    }
  }, [loadState, routeGeometry, routeStatus, styleUrl]);

  const isAwaitingPassThroughPoint = interactionMode === "add_pass_through";
  const interactionLabel = isAwaitingPassThroughPoint
    ? "Add pass-through"
    : isMapStartActive
      ? "Move start point"
      : "Preview only";
  const statusHeading =
    loadState === "error"
      ? "Self-hosted map unavailable"
      : isAwaitingPassThroughPoint
        ? "Click map to add a pass-through point"
        : isMapStartActive
          ? "Click map to move the start point"
          : routeGeometry
            ? "Routed preview is rendered"
            : loadState === "ready"
              ? "Planning map is live"
              : "Loading self-hosted map";
  const statusBody =
    loadState === "error"
      ? errorMessage
      : isAwaitingPassThroughPoint
        ? `The next map click will append pass-through point ${passThroughPoints.length + 1} and keep the existing list intact.`
        : isMapStartActive
          ? "Map-selected start mode is active. Each map click updates the route origin and request preview immediately."
          : routeGeometry
            ? "The latest backend preview returned route geometry, and the live map is now drawing that line alongside the planning markers."
            : loadState === "ready"
              ? "The live planning surface is mounted. Choose `Map-selected point` or arm a pass-through pick to make the map interactive."
              : "Connecting to the configured style document before route overlays and point selection are added.";

  return (
    <section
      className={`planning-map planning-map--${loadState}`}
      aria-label="Planning map"
    >
      <div ref={containerRef} className="planning-map__canvas" />
      <div className="planning-map__status" role="status" aria-live="polite">
        <p className="map-label">Live MapLibre surface</p>
        <h3>{statusHeading}</h3>
        <p>{statusBody}</p>
        <dl className="planning-map__facts">
          <div>
            <dt>Region</dt>
            <dd>{regionName}</dd>
          </div>
          <div>
            <dt>Center</dt>
            <dd>{centerLabel}</dd>
          </div>
          <div>
            <dt>Coordinate</dt>
            <dd>{formatCoordinate(center)}</dd>
          </div>
          <div>
            <dt>Interaction</dt>
            <dd>{interactionLabel}</dd>
          </div>
          <div>
            <dt>Waypoints</dt>
            <dd>{passThroughPoints.length}</dd>
          </div>
          <div>
            <dt>Route line</dt>
            <dd>
              {routeGeometry
                ? `${routeGeometry.coordinates.length} points`
                : "Not available"}
            </dd>
          </div>
          <div>
            <dt>Style</dt>
            <dd>
              <code>{trimStyleUrl(styleUrl)}</code>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function formatCoordinate(coordinate: Coordinate) {
  return `${coordinate.lat.toFixed(4)}, ${coordinate.lon.toFixed(4)}`;
}

function createMarkerElement(
  kind: "start" | "waypoint",
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
    });
  }

  if (!map.getLayer(ROUTE_PREVIEW_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_PREVIEW_CASING_LAYER_ID,
      type: "line",
      source: ROUTE_PREVIEW_SOURCE_ID,
      paint: {
        "line-color": "rgba(20, 33, 61, 0.92)",
        "line-opacity": 0.42,
        "line-width": 8,
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
        "line-color": "#6b7a34",
        "line-width": 4.8,
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

  map.setPaintProperty(
    ROUTE_PREVIEW_LINE_LAYER_ID,
    "line-color",
    routeStatus === "partial" ? "#c98a2d" : "#6b7a34",
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

function getMapErrorMessage(error: unknown, styleUrl: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return `Could not load the self-hosted style at ${styleUrl}. Check that the tile stack is running and the style URL is reachable.`;
}

function trimStyleUrl(styleUrl: string) {
  try {
    const { origin, pathname } = new URL(styleUrl);

    return `${origin}${pathname}`;
  } catch {
    return styleUrl;
  }
}
