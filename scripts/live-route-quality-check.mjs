const DEFAULT_APP_URL = "http://127.0.0.1:5173";
const DISTANCE_DELTA_ROUNDING_TOLERANCE_METERS = 10;
const SURFACE_PERCENT_TOTAL_TOLERANCE = 1;

const { appUrl } = parseArguments(process.argv.slice(2));
const normalizedAppUrl = new URL(appUrl);

const previewRequest = {
  start: { lat: 53.9188, lon: 9.8872 },
  targetDistanceKm: 8,
  activity: "running_walking",
  surfacePreference: "mixed",
  passThroughPoints: [],
  randomSeed: null,
  toleranceMeters: 150,
};
const outOfRegionRequest = {
  start: { lat: 52.52, lon: 13.405 },
  targetDistanceKm: 8,
  activity: "running_walking",
  surfacePreference: "mixed",
  passThroughPoints: [],
  randomSeed: null,
  toleranceMeters: 150,
};

const previewResponse = await postRouteGenerate(previewRequest);
const failureResponse = await postRouteGenerate(outOfRegionRequest);

const checks = [
  checkPreviewGeometryAndInstructions(previewResponse),
  checkPreviewDistanceAndSurfaceHonesty(previewRequest, previewResponse),
  checkOutOfRegionFailure(failureResponse),
];

const failedChecks = checks.filter((check) => !check.ok);

console.log(
  JSON.stringify(
    {
      appUrl: normalizedAppUrl.toString(),
      checks,
    },
    null,
    2,
  ),
);

if (failedChecks.length > 0) {
  process.exit(1);
}

async function postRouteGenerate(request) {
  const response = await fetch(
    new URL("/api/routes/generate", normalizedAppUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
  const body = await response.json();

  return {
    body,
    httpStatus: response.status,
    request,
  };
}

function checkPreviewGeometryAndInstructions(response) {
  const geometryCoordinates = response.body.geometry?.coordinates;
  const instructions = response.body.instructions;
  const firstInstructionCoordinate = instructions?.[0]?.coordinate ?? null;
  const lastInstructionCoordinate =
    instructions?.[instructions.length - 1]?.coordinate ?? null;
  const firstGeometryCoordinate = geometryCoordinates?.[0] ?? null;
  const lastGeometryCoordinate =
    geometryCoordinates?.[geometryCoordinates.length - 1] ?? null;
  const ok =
    response.httpStatus === 200 &&
    (response.body.status === "success" ||
      response.body.status === "partial") &&
    Array.isArray(geometryCoordinates) &&
    geometryCoordinates.length > 1 &&
    Array.isArray(instructions) &&
    instructions.length > 1 &&
    coordinatesEqual(firstInstructionCoordinate, firstGeometryCoordinate) &&
    coordinatesEqual(lastInstructionCoordinate, lastGeometryCoordinate);

  return {
    id: "preview_geometry_and_instructions",
    ok,
    evidence: {
      firstGeometryCoordinate,
      firstInstructionCoordinate,
      geometryPoints: Array.isArray(geometryCoordinates)
        ? geometryCoordinates.length
        : 0,
      httpStatus: response.httpStatus,
      instructionCount: Array.isArray(instructions) ? instructions.length : 0,
      lastGeometryCoordinate,
      lastInstructionCoordinate,
      status: response.body.status,
      warningCodes: listWarningCodes(response.body.warnings),
    },
  };
}

function checkPreviewDistanceAndSurfaceHonesty(request, response) {
  const summary = response.body.summary;
  const warningCodes = listWarningCodes(response.body.warnings);
  const surface = summary?.surface ?? null;
  const surfacePercentTotal =
    (surface?.asphaltPercent ?? 0) +
    (surface?.trailUnpavedPercent ?? 0) +
    (surface?.fieldTrackOtherPercent ?? 0) +
    (surface?.unknownPercent ?? 0);
  const computedDistanceDeltaMeters =
    summary === null
      ? null
      : Math.round(
          summary.totalDistanceKm * 1_000 - request.targetDistanceKm * 1_000,
        );
  const distanceWarningPresent = warningCodes.includes(
    "distance_outside_tolerance",
  );
  const surfaceWarningPresent = warningCodes.includes(
    "surface_data_incomplete",
  );
  const shouldHaveDistanceWarning =
    summary === null
      ? false
      : Math.abs(summary.distanceDeltaMeters) > request.toleranceMeters;
  const shouldHaveSurfaceWarning =
    surface !== null && (surface.unknownPercent ?? 0) > 0;
  const ok =
    summary !== null &&
    computedDistanceDeltaMeters !== null &&
    Math.abs(computedDistanceDeltaMeters - summary.distanceDeltaMeters) <=
      DISTANCE_DELTA_ROUNDING_TOLERANCE_METERS &&
    Math.abs(surfacePercentTotal - 100) <= SURFACE_PERCENT_TOTAL_TOLERANCE &&
    distanceWarningPresent === shouldHaveDistanceWarning &&
    surfaceWarningPresent === shouldHaveSurfaceWarning;

  return {
    id: "preview_distance_and_surface_honesty",
    ok,
    evidence: {
      computedDistanceDeltaMeters,
      distanceDeltaMeters: summary?.distanceDeltaMeters ?? null,
      distanceWarningPresent,
      shouldHaveDistanceWarning,
      shouldHaveSurfaceWarning,
      status: response.body.status,
      surfacePercentTotal,
      surfaceSummary: surface,
      surfaceWarningPresent,
      targetDistanceKm: request.targetDistanceKm,
      toleranceMeters: request.toleranceMeters,
      totalDistanceKm: summary?.totalDistanceKm ?? null,
      warningCodes,
    },
  };
}

function checkOutOfRegionFailure(response) {
  const ok =
    response.httpStatus === 200 &&
    response.body.status === "failed" &&
    listWarningCodes(response.body.warnings).includes(
      "request_points_out_of_supported_region",
    ) &&
    response.body.summary === null &&
    response.body.geometry === null &&
    response.body.instructions === null;

  return {
    id: "out_of_region_failure_is_explicit",
    ok,
    evidence: {
      geometry: response.body.geometry,
      httpStatus: response.httpStatus,
      instructions: response.body.instructions,
      routeId: response.body.routeId,
      status: response.body.status,
      summary: response.body.summary,
      warningCodes: listWarningCodes(response.body.warnings),
    },
  };
}

function coordinatesEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === 2 &&
    right.length === 2 &&
    left[0] === right[0] &&
    left[1] === right[1]
  );
}

function listWarningCodes(warnings) {
  return Array.isArray(warnings)
    ? warnings.flatMap((warning) =>
        typeof warning?.code === "string" ? [warning.code] : [],
      )
    : [];
}

function parseArguments(argv) {
  const parsed = {
    appUrl: DEFAULT_APP_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--app-url":
        parsed.appUrl = argv[index + 1] ?? parsed.appUrl;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return parsed;
}
