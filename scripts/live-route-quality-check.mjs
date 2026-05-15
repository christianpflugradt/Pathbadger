const DEFAULT_APP_URL = "http://127.0.0.1:5173";
const DISTANCE_DELTA_ROUNDING_TOLERANCE_METERS = 10;
const MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS = 400;
const MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS = 150;
const MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS = 50;
const MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS = 500;
const LOOP_METRIC_ROUNDING_TOLERANCE_METERS = 5;
const SURFACE_PERCENT_TOTAL_TOLERANCE = 1;

const { appUrl, requireElevation } = parseArguments(process.argv.slice(2));
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
  checkPreviewGeometryAndInstructionEndpoints(previewResponse),
  checkPreviewDistanceAndSurfaceHonesty(previewRequest, previewResponse),
  checkPreviewRoundTripContract(previewRequest, previewResponse),
  ...(requireElevation ? [checkPreviewElevationGain(previewResponse)] : []),
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

function checkPreviewGeometryAndInstructionEndpoints(response) {
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
    id: "preview_geometry_and_instruction_endpoints",
    ok,
    description:
      "Verifies only the first and last instruction coordinates against the returned route geometry endpoints.",
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
  const withinSupportedDistanceLimit =
    summary !== null &&
    Math.abs(summary.distanceDeltaMeters) <=
      MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS;
  const shouldHaveDistanceWarning =
    summary === null
      ? false
      : Math.abs(summary.distanceDeltaMeters) > request.toleranceMeters;
  const shouldHaveSurfaceWarning =
    surface !== null && (surface.unknownPercent ?? 0) > 0;
  const ok =
    summary !== null &&
    computedDistanceDeltaMeters !== null &&
    withinSupportedDistanceLimit &&
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
      withinSupportedDistanceLimit,
      maximumAcceptableDistanceDeltaMeters:
        MAXIMUM_ACCEPTABLE_DISTANCE_DELTA_METERS,
      targetDistanceKm: request.targetDistanceKm,
      toleranceMeters: request.toleranceMeters,
      totalDistanceKm: summary?.totalDistanceKm ?? null,
      warningCodes,
    },
  };
}

function checkPreviewElevationGain(response) {
  const elevationGainMeters =
    response.body.summary?.elevationGainMeters ?? null;
  const ok =
    response.httpStatus === 200 &&
    (response.body.status === "success" ||
      response.body.status === "partial") &&
    Number.isFinite(elevationGainMeters);

  return {
    id: "preview_elevation_gain_is_available",
    ok,
    evidence: {
      elevationGainMeters,
      httpStatus: response.httpStatus,
      status: response.body.status,
      warningCodes: listWarningCodes(response.body.warnings),
    },
  };
}

function checkPreviewRoundTripContract(request, response) {
  const summary = response.body.summary;
  const geometryCoordinates = response.body.geometry?.coordinates ?? null;
  const computedLoop =
    summary === null || !Array.isArray(geometryCoordinates)
      ? null
      : summarizeRouteLoop({
          geometryCoordinates,
          requestedStart: request.start,
        });
  const reportedLoop = summary?.loop ?? null;
  const withinSupportedRoundTripContract =
    computedLoop !== null &&
    computedLoop.startOffsetMeters <=
      MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS &&
    computedLoop.endOffsetMeters <=
      MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS &&
    computedLoop.closureGapMeters <= MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS &&
    computedLoop.bidirectionalOverlapMeters <=
      MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS;
  const loopMatchesSummary =
    computedLoop !== null &&
    reportedLoop !== null &&
    Math.abs(computedLoop.startOffsetMeters - reportedLoop.startOffsetMeters) <=
      LOOP_METRIC_ROUNDING_TOLERANCE_METERS &&
    Math.abs(computedLoop.endOffsetMeters - reportedLoop.endOffsetMeters) <=
      LOOP_METRIC_ROUNDING_TOLERANCE_METERS &&
    Math.abs(computedLoop.closureGapMeters - reportedLoop.closureGapMeters) <=
      LOOP_METRIC_ROUNDING_TOLERANCE_METERS &&
    Math.abs(
      computedLoop.bidirectionalOverlapMeters -
        reportedLoop.bidirectionalOverlapMeters,
    ) <= LOOP_METRIC_ROUNDING_TOLERANCE_METERS;
  const ok =
    response.httpStatus === 200 &&
    (response.body.status === "success" ||
      response.body.status === "partial") &&
    computedLoop !== null &&
    reportedLoop !== null &&
    withinSupportedRoundTripContract &&
    loopMatchesSummary;

  return {
    id: "preview_round_trip_contract",
    ok,
    evidence: {
      computedLoop,
      httpStatus: response.httpStatus,
      maximumAcceptableBidirectionalOverlapMeters:
        MAXIMUM_ACCEPTABLE_BIDIRECTIONAL_OVERLAP_METERS,
      maximumAcceptableClosureGapMeters: MAXIMUM_ACCEPTABLE_CLOSURE_GAP_METERS,
      maximumAcceptableStartAreaOffsetMeters:
        MAXIMUM_ACCEPTABLE_START_AREA_OFFSET_METERS,
      reportedLoop,
      status: response.body.status,
      warningCodes: listWarningCodes(response.body.warnings),
      withinSupportedRoundTripContract,
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

function summarizeRouteLoop({ geometryCoordinates, requestedStart }) {
  const routeStart = lineStringCoordinateToCoordinate(geometryCoordinates[0]);
  const routeEnd = lineStringCoordinateToCoordinate(
    geometryCoordinates[geometryCoordinates.length - 1],
  );

  return {
    startOffsetMeters: Math.round(
      haversineDistanceMeters(requestedStart, routeStart),
    ),
    endOffsetMeters: Math.round(
      haversineDistanceMeters(requestedStart, routeEnd),
    ),
    closureGapMeters: Math.round(haversineDistanceMeters(routeStart, routeEnd)),
    bidirectionalOverlapMeters: Math.round(
      calculateBidirectionalOverlapMeters(geometryCoordinates),
    ),
  };
}

function calculateBidirectionalOverlapMeters(geometryCoordinates) {
  const sampledSegments = sampleRouteSegments(geometryCoordinates);
  const totalDistanceMeters = sampledSegments.reduce(
    (total, segment) => total + segment.lengthMeters,
    0,
  );
  let markedOverlapLengthMeters = 0;

  for (
    let segmentIndex = 0;
    segmentIndex < sampledSegments.length;
    segmentIndex += 1
  ) {
    const segment = sampledSegments[segmentIndex];

    const hasOppositeDirectionMatch = sampledSegments.some(
      (otherSegment, otherSegmentIndex) => {
        if (segmentIndex === otherSegmentIndex) {
          return false;
        }

        const routeDistanceDifference = Math.abs(
          segment.distanceFromStartMeters -
            otherSegment.distanceFromStartMeters,
        );

        if (routeDistanceDifference <= 80) {
          return false;
        }

        if (totalDistanceMeters - routeDistanceDifference <= 80) {
          return false;
        }

        if (
          haversineDistanceMeters(segment.midpoint, otherSegment.midpoint) > 20
        ) {
          return false;
        }

        const directionDotProduct =
          segment.direction.x * otherSegment.direction.x +
          segment.direction.y * otherSegment.direction.y;

        return directionDotProduct <= -0.85;
      },
    );

    if (hasOppositeDirectionMatch) {
      markedOverlapLengthMeters += segment.lengthMeters;
    }
  }

  return markedOverlapLengthMeters / 2;
}

function sampleRouteSegments(geometryCoordinates) {
  const sampledSegments = [];
  let routeDistanceMeters = 0;

  for (let index = 1; index < geometryCoordinates.length; index += 1) {
    const startCoordinate = geometryCoordinates[index - 1];
    const endCoordinate = geometryCoordinates[index];

    if (!Array.isArray(startCoordinate) || !Array.isArray(endCoordinate)) {
      continue;
    }

    const start = lineStringCoordinateToCoordinate(startCoordinate);
    const end = lineStringCoordinateToCoordinate(endCoordinate);
    const segmentLengthMeters = haversineDistanceMeters(start, end);

    if (segmentLengthMeters === 0) {
      continue;
    }

    const direction = calculateDirectionVector(start, end);

    for (
      let sampledDistanceMeters = 0;
      sampledDistanceMeters < segmentLengthMeters;
      sampledDistanceMeters += 20
    ) {
      const chunkLengthMeters = Math.min(
        20,
        segmentLengthMeters - sampledDistanceMeters,
      );
      const midpointFraction =
        (sampledDistanceMeters + chunkLengthMeters / 2) / segmentLengthMeters;

      sampledSegments.push({
        midpoint: interpolateCoordinate(start, end, midpointFraction),
        direction,
        distanceFromStartMeters:
          routeDistanceMeters + sampledDistanceMeters + chunkLengthMeters / 2,
        lengthMeters: chunkLengthMeters,
      });
    }

    routeDistanceMeters += segmentLengthMeters;
  }

  return sampledSegments;
}

function lineStringCoordinateToCoordinate(coordinate) {
  return {
    lat: coordinate[1],
    lon: coordinate[0],
  };
}

function haversineDistanceMeters(start, end) {
  const startLatitudeRadians = toRadians(start.lat);
  const endLatitudeRadians = toRadians(end.lat);
  const deltaLatitudeRadians = toRadians(end.lat - start.lat);
  const deltaLongitudeRadians = toRadians(end.lon - start.lon);
  const a =
    Math.sin(deltaLatitudeRadians / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(deltaLongitudeRadians / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return 6_371_000 * c;
}

function calculateDirectionVector(start, end) {
  const referenceLatitudeRadians = toRadians((start.lat + end.lat) / 2);
  const x =
    toRadians(end.lon - start.lon) *
    6_371_000 *
    Math.cos(referenceLatitudeRadians);
  const y = toRadians(end.lat - start.lat) * 6_371_000;
  const magnitude = Math.hypot(x, y);

  return {
    x: x / magnitude,
    y: y / magnitude,
  };
}

function interpolateCoordinate(start, end, fraction) {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lon: start.lon + (end.lon - start.lon) * fraction,
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function parseArguments(argv) {
  const parsed = {
    appUrl: DEFAULT_APP_URL,
    requireElevation: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--app-url":
        parsed.appUrl = argv[index + 1] ?? parsed.appUrl;
        index += 1;
        break;
      case "--require-elevation":
        parsed.requireElevation = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return parsed;
}
