import {
  activitySchema,
  coordinateSchema,
  routeGeometrySchema,
} from "@pathbadger/shared";
import type { Activity, Coordinate, RouteGeometry } from "@pathbadger/shared";
import { z } from "zod";

const GRAPHHOPPER_ROUTE_PATH = "/api/1/route";
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
  surfaceDetails: GraphHopperRouteSurfaceDetail[];
}

export interface RoutingEngineAdapter {
  getRoute(request: GraphHopperRouteRequest): Promise<GraphHopperRouteResult>;
}

export interface CreateGraphHopperAdapterOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
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
        elevationGainMeters: path.ascend ?? null,
        geometry: path.points,
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
    });
  }

  return createGraphHopperAdapter({
    baseUrl,
  });
}

function buildRouteUrl(baseUrl: string, request: GraphHopperRouteRequest): URL {
  const url = new URL(GRAPHHOPPER_ROUTE_PATH, withTrailingSlash(baseUrl));

  for (const point of request.points) {
    url.searchParams.append("point", `${point.lat},${point.lon}`);
  }

  url.searchParams.set("profile", toGraphHopperProfile(request.activity));
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "false");
  url.searchParams.set("elevation", "true");
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

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
