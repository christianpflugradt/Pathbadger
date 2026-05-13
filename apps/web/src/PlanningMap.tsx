import { useEffect, useRef, useState } from "react";
import type { Coordinate } from "@pathbadger/shared";
import maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

type PlanningMapProps = {
  center: Coordinate;
  centerLabel: string;
  regionName: string;
  styleUrl: string;
};

type MapLoadState = "loading" | "ready" | "error";

const DEFAULT_ZOOM = 11.5;

export function PlanningMap({
  center,
  centerLabel,
  regionName,
  styleUrl,
}: PlanningMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialCenterRef = useRef(center);
  const mapRef = useRef<maplibregl.Map | null>(null);
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

  const statusHeading =
    loadState === "ready"
      ? "Planning map is live"
      : loadState === "error"
        ? "Self-hosted map unavailable"
        : "Loading self-hosted map";
  const statusBody =
    loadState === "ready"
      ? "The live planning surface is mounted. Point-picking lands next, so the current form still owns the route request state."
      : loadState === "error"
        ? errorMessage
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
  const { origin, pathname } = new URL(styleUrl);

  return `${origin}${pathname}`;
}
