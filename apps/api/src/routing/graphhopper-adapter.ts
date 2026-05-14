import {
  activitySchema,
  coordinateSchema,
  routeGeometrySchema,
} from "@pathbadger/shared";
import type {
  Activity,
  Coordinate,
  RouteGeometry,
  RouteInstruction,
} from "@pathbadger/shared";
import { z } from "zod";

const GRAPHHOPPER_ROUTE_PATH = "/route";
const graphHopperTextPathDetailSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.string().nullable(),
]);
const graphHopperDistancePathDetailSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().nonnegative(),
]);
const graphHopperInstructionIntervalSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
const graphHopperInstructionSchema = z
  .object({
    distance: z.number().nonnegative(),
    sign: z.number().int(),
    interval: graphHopperInstructionIntervalSchema,
    text: z.string(),
    street_name: z.string().nullable().optional(),
  })
  .passthrough();
const graphHopperPathDetailsSchema = z
  .object({
    surface: z.array(graphHopperTextPathDetailSchema).optional(),
    road_class: z.array(graphHopperTextPathDetailSchema).optional(),
    distance: z.array(graphHopperDistancePathDetailSchema).optional(),
  })
  .passthrough();
const graphHopperRouteRequestSchema = z.object({
  points: z.array(coordinateSchema).min(2),
  activity: activitySchema,
});
const graphHopperPathSchema = z.object({
  distance: z.number().nonnegative(),
  time: z.number().nonnegative().optional(),
  ascend: z.number().nullable().optional(),
  points: routeGeometrySchema,
  instructions: z.array(graphHopperInstructionSchema).optional(),
  details: graphHopperPathDetailsSchema.optional(),
});
const graphHopperResponseSchema = z.object({
  paths: z.array(graphHopperPathSchema).min(1),
});

export const DEFAULT_GRAPHHOPPER_URL = "http://graphhopper:8989";

export interface GraphHopperRouteRequest {
  points: Coordinate[];
  activity: Activity;
}

export interface GraphHopperRouteSurfaceDetail {
  distanceMeters: number;
  surface: string | null;
  roadClass: string | null;
}

export interface GraphHopperRouteResult {
  distanceMeters: number;
  durationMs: number | null;
  elevationGainMeters: number | null;
  geometry: RouteGeometry;
  instructions: RouteInstruction[];
  surfaceDetails: GraphHopperRouteSurfaceDetail[];
}

export interface RoutingEngineAdapter {
  getRoute(request: GraphHopperRouteRequest): Promise<GraphHopperRouteResult>;
}

export interface CreateGraphHopperAdapterOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  hasElevation?: boolean;
}

export class GraphHopperUnavailableError extends Error {
  readonly code = "routing_engine_unavailable";
  readonly statusCode: number | null;

  constructor(message: string, statusCode: number | null = null) {
    super(message);
    this.name = "GraphHopperUnavailableError";
    this.statusCode = statusCode;
  }
}

export class GraphHopperInvalidResponseError extends Error {
  readonly code = "invalid_graphhopper_response";

  constructor(message: string) {
    super(message);
    this.name = "GraphHopperInvalidResponseError";
  }
}

export function createGraphHopperAdapter(
  options: CreateGraphHopperAdapterOptions,
): RoutingEngineAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const hasElevation = options.hasElevation ?? true;

  return {
    async getRoute(request: GraphHopperRouteRequest) {
      const parsedRequest = graphHopperRouteRequestSchema.parse(request);
      const requestUrl = buildRouteUrl(options.baseUrl, parsedRequest);

      let response: Response;

      try {
        response = await fetchImpl(requestUrl);
      } catch {
        throw new GraphHopperUnavailableError(
          "GraphHopper is unavailable for route requests.",
        );
      }

      if (!response.ok) {
        throw new GraphHopperUnavailableError(
          `GraphHopper returned ${response.status} for route requests.`,
          response.status,
        );
      }

      const payload = graphHopperResponseSchema.safeParse(
        await response.json(),
      );

      if (!payload.success) {
        throw new GraphHopperInvalidResponseError(
          "GraphHopper returned an unexpected route payload.",
        );
      }

      const path = payload.data.paths[0];

      if (!path) {
        throw new GraphHopperInvalidResponseError(
          "GraphHopper returned an empty paths list.",
        );
      }

      return {
        distanceMeters: path.distance,
        durationMs: path.time ?? null,
        elevationGainMeters: hasElevation ? (path.ascend ?? null) : null,
        geometry: path.points,
        instructions: normalizeRouteInstructions(path),
        surfaceDetails: normalizeRouteSurfaceDetails(path),
      };
    },
  };
}

export function createGraphHopperAdapterFromEnv(
  fetchImpl?: typeof fetch,
): RoutingEngineAdapter {
  const baseUrl = process.env.GRAPHHOPPER_URL ?? DEFAULT_GRAPHHOPPER_URL;

  if (fetchImpl) {
    return createGraphHopperAdapter({
      baseUrl,
      fetchImpl,
      hasElevation: hasGraphHopperElevationSupport(),
    });
  }

  return createGraphHopperAdapter({
    baseUrl,
    hasElevation: hasGraphHopperElevationSupport(),
  });
}

function buildRouteUrl(baseUrl: string, request: GraphHopperRouteRequest): URL {
  const url = new URL(GRAPHHOPPER_ROUTE_PATH, withTrailingSlash(baseUrl));

  for (const point of request.points) {
    url.searchParams.append("point", `${point.lat},${point.lon}`);
  }

  url.searchParams.set("profile", toGraphHopperProfile(request.activity));
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "true");
  url.searchParams.append("details", "surface");
  url.searchParams.append("details", "road_class");
  url.searchParams.append("details", "distance");

  return url;
}

function normalizeRouteSurfaceDetails(
  path: z.infer<typeof graphHopperPathSchema>,
) {
  const distanceDetails = path.details?.distance;

  if (!distanceDetails || distanceDetails.length === 0) {
    return [createUnknownRouteSurfaceDetail(path.distance)];
  }

  // GraphHopper returns path details as point-index intervals. We anchor on the
  // documented distance intervals so every normalized segment carries a stable
  // meter count even when surface or road-class details span multiple edges.
  return distanceDetails.reduce<GraphHopperRouteSurfaceDetail[]>(
    (normalizedDetails, [fromPointIndex, toPointIndex, distanceMeters]) => {
      const nextDetail = {
        distanceMeters,
        surface: findTextPathDetailValue(
          path.details?.surface,
          fromPointIndex,
          toPointIndex,
        ),
        roadClass: findTextPathDetailValue(
          path.details?.road_class,
          fromPointIndex,
          toPointIndex,
        ),
      };
      const lastDetail = normalizedDetails.at(-1);

      if (
        lastDetail &&
        lastDetail.surface === nextDetail.surface &&
        lastDetail.roadClass === nextDetail.roadClass
      ) {
        lastDetail.distanceMeters += nextDetail.distanceMeters;
        return normalizedDetails;
      }

      normalizedDetails.push(nextDetail);
      return normalizedDetails;
    },
    [],
  );
}

function normalizeRouteInstructions(
  path: z.infer<typeof graphHopperPathSchema>,
): RouteInstruction[] {
  const rawInstructions = path.instructions;

  if (!rawInstructions || rawInstructions.length === 0) {
    return [];
  }

  let distanceFromStartMeters = 0;

  return rawInstructions.map((instruction, index) => {
    const coordinateIndex = instruction.interval[0];
    const coordinate = path.points.coordinates[coordinateIndex];

    if (!coordinate) {
      throw new GraphHopperInvalidResponseError(
        "GraphHopper instruction interval points outside the returned geometry.",
      );
    }

    const normalizedInstruction: RouteInstruction = {
      distanceFromStartMeters: roundInstructionDistance(
        distanceFromStartMeters,
      ),
      distanceToNextMeters:
        index === rawInstructions.length - 1
          ? null
          : roundInstructionDistance(instruction.distance),
      type: mapInstructionType(instruction.sign, index === 0),
      text: normalizeInstructionText(
        instruction.text,
        mapInstructionType(instruction.sign, index === 0),
      ),
      streetName: normalizePathDetailText(instruction.street_name ?? null),
      coordinate,
    };

    distanceFromStartMeters += instruction.distance;

    return normalizedInstruction;
  });
}

function findTextPathDetailValue(
  detailEntries:
    | Array<z.infer<typeof graphHopperTextPathDetailSchema>>
    | undefined,
  fromPointIndex: number,
  toPointIndex: number,
) {
  const detailEntry = detailEntries?.find(
    ([detailFromPointIndex, detailToPointIndex]) =>
      fromPointIndex >= detailFromPointIndex &&
      toPointIndex <= detailToPointIndex,
  );

  return normalizePathDetailText(detailEntry?.[2] ?? null);
}

function normalizePathDetailText(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function createUnknownRouteSurfaceDetail(
  distanceMeters: number,
): GraphHopperRouteSurfaceDetail {
  return {
    distanceMeters,
    surface: null,
    roadClass: null,
  };
}

function toGraphHopperProfile(activity: Activity) {
  if (activity === "cycling") {
    return "bike";
  }

  return "foot";
}

function mapInstructionType(sign: number, isFirstInstruction: boolean) {
  if (isFirstInstruction) {
    return "depart";
  }

  switch (sign) {
    case -8:
      return "u_turn_left";
    case -7:
      return "keep_left";
    case -3:
      return "turn_sharp_left";
    case -2:
      return "turn_left";
    case -1:
      return "turn_slight_left";
    case 0:
      return "continue";
    case 1:
      return "turn_slight_right";
    case 2:
      return "turn_right";
    case 3:
      return "turn_sharp_right";
    case 4:
      return "arrive";
    case 5:
      return "via";
    case 6:
      return "roundabout";
    case 7:
      return "keep_right";
    case 8:
      return "u_turn_right";
    default:
      return `instruction_${sign}`;
  }
}

function hasGraphHopperElevationSupport() {
  return (process.env.GRAPHHOPPER_HAS_ELEVATION ?? "false") === "true";
}

function normalizeInstructionText(text: string, instructionType: string) {
  const trimmedText = text.trim();

  if (trimmedText.length > 0) {
    return trimmedText;
  }

  return fallbackInstructionText(instructionType);
}

function fallbackInstructionText(instructionType: string) {
  switch (instructionType) {
    case "depart":
      return "Start route";
    case "arrive":
      return "Arrive at destination";
    case "via":
      return "Continue via waypoint";
    case "roundabout":
      return "Take the roundabout";
    case "continue":
      return "Continue";
    default:
      return "Continue on route";
  }
}

function roundInstructionDistance(distanceMeters: number) {
  return Number(distanceMeters.toFixed(1));
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
