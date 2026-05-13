import { useRef, useState } from "react";
import {
  DEFAULT_DISTANCE_TOLERANCE_METERS,
  activityOptions,
  surfacePreferenceOptions,
} from "@pathbadger/shared";
import type {
  Activity,
  Coordinate,
  RouteGenerateRequest,
  RouteGenerateResponse,
  SurfacePreference,
} from "@pathbadger/shared";

import { webRuntimeConfig } from "./config";
import { PlanningMap } from "./PlanningMap";
import { requestRoutePreview } from "./route-preview-client";
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

const startPointCatalog: Record<
  StartPointMode,
  {
    label: string;
    detail: string;
    coordinate: Coordinate;
  }
> = {
  current_position: {
    label: "Current GPS position",
    detail: "Fastest option once location permission is granted.",
    coordinate: { lat: 54.3233, lon: 10.1228 },
  },
  map_point: {
    label: "Map-selected point",
    detail: "Live map clicks set the planning start.",
    coordinate: { lat: 54.3362, lon: 10.1464 },
  },
  saved_default: {
    label: "Remembered default",
    detail: "Useful for repeated trailheads or home starts.",
    coordinate: { lat: 54.2981, lon: 10.1714 },
  },
  last_used: {
    label: "Last used start",
    detail: "Fallback when no explicit start is chosen.",
    coordinate: { lat: 54.3448, lon: 10.1021 },
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

export function App() {
  const [startPointMode, setStartPointMode] =
    useState<StartPointMode>("map_point");
  const [mapSelectedStart, setMapSelectedStart] = useState<Coordinate>(
    startPointCatalog.map_point.coordinate,
  );
  const [mapInteractionMode, setMapInteractionMode] =
    useState<MapInteractionMode>("idle");
  const [activity, setActivity] = useState<Activity>("running_walking");
  const [surfacePreference, setSurfacePreference] =
    useState<SurfacePreference>("trail");
  const [targetDistanceKm, setTargetDistanceKm] = useState(12);
  const [passThroughPoints, setPassThroughPoints] = useState<
    PassThroughPoint[]
  >([]);
  const [previewCandidateIndex, setPreviewCandidateIndex] = useState(1);
  const [routePreview, setRoutePreview] =
    useState<RouteGenerateResponse | null>(null);
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

  const startPoint =
    startPointMode === "map_point"
      ? {
          ...startPointCatalog.map_point,
          coordinate: mapSelectedStart,
          detail: "Click the live map to set the route origin.",
        }
      : startPointCatalog[startPointMode];
  const isAwaitingPassThroughPoint = mapInteractionMode === "add_pass_through";
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

  function handleStartPointModeChange(mode: StartPointMode) {
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
            <span className="status-pill">Navigation later</span>
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

          <section className="form-section">
            <div className="section-heading">
              <h3>Start point</h3>
              <p>Choose how the route origin should be defined.</p>
            </div>
            <div className="option-grid">
              {(
                Object.entries(startPointCatalog) as [
                  StartPointMode,
                  (typeof startPointCatalog)[StartPointMode],
                ][]
              ).map(([mode, option]) => (
                <button
                  key={mode}
                  type="button"
                  className={`option-card${
                    startPointMode === mode ? " option-card--selected" : ""
                  }`}
                  onClick={() => handleStartPointModeChange(mode)}
                >
                  <span className="option-title">{option.label}</span>
                  <span className="option-detail">{option.detail}</span>
                </button>
              ))}
            </div>
            {startPointMode === "map_point" ? (
              <p className="helper-copy">
                Map-selected start:{" "}
                <code>{formatCoordinate(mapSelectedStart)}</code>. Click the
                planning map to move it.
              </p>
            ) : null}
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
                  className={`segment${
                    activity === option ? " segment--selected" : ""
                  }`}
                  onClick={() => setActivity(option)}
                >
                  {activityLabels[option]}
                </button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <h3>Target distance</h3>
              <p>Distance stays in kilometers, with tolerance handled later.</p>
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
              <p>
                Scoring comes later, but the preference is already explicit.
              </p>
            </div>
            <div className="segmented-grid segmented-grid--surface">
              {surfacePreferenceOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`segment${
                    surfacePreference === option ? " segment--selected" : ""
                  }`}
                  onClick={() => setSurfacePreference(option)}
                >
                  {surfaceLabels[option]}
                </button>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <h3>Pass-through points</h3>
              <p>
                Pass-through waypoints now come from live map clicks. Local
                place search can be layered in later.
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
              <button type="button" className="button button--ghost" disabled>
                Place search later
              </button>
            </div>
            <p className="helper-copy">
              {isAwaitingPassThroughPoint
                ? `Click the planning map to add pass-through point ${passThroughPoints.length + 1}.`
                : "Each pass-through point is now created from a real map click and can still be removed from the list."}
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
                disabled={isRequestingRoutePreview}
                onClick={requestRoute}
              >
                {isRequestingRoutePreview ? "Generating..." : "Generate route"}
              </button>
              <button
                type="button"
                className="button button--secondary"
                disabled={isRequestingRoutePreview}
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
                : routePreviewRequestError
                  ? routePreviewRequestError
                  : isRoutePreviewStale
                    ? "Planning inputs changed since the last routed preview. Generate again to refresh the map and summary."
                    : hasRoutePreview
                      ? "The planner now renders a real backend route preview, including warnings and geometry when the API can provide them."
                      : "Generate a route to call the backend preview boundary for the first time."}
            </p>
          </section>
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
              center={startPoint.coordinate}
              centerLabel={startPoint.label}
              isMapStartActive={startPointMode === "map_point"}
              interactionMode={mapInteractionMode}
              onMapSelect={handleMapSelection}
              passThroughPoints={passThroughPoints}
              regionName={webRuntimeConfig.regionName}
              routeGeometry={routePreview?.geometry ?? null}
              routeStatus={routePreview?.status ?? null}
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
                      : "used the backend's derived fallback seed."}{" "}
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

          <article className="card navigation-handoff">
            <div className="panel-heading">
              <div>
                <p className="section-label">Execution state</p>
                <h2>Navigation stays separate</h2>
              </div>
              <span className="status-pill">Locked for now</span>
            </div>
            <p className="panel-copy">
              Route execution controls stay out of the planning state until a
              confirmed route exists.
            </p>
            <ul className="handoff-list">
              <li>
                Current route line and follow-position behavior come later.
              </li>
              <li>
                Instruction cues, progress metrics, and off-route alerts stay in
                the navigation phase.
              </li>
              <li>
                Start navigation remains disabled until route preview work is
                real.
              </li>
            </ul>
            <button type="button" className="button button--ghost" disabled>
              Start navigation later
            </button>
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
