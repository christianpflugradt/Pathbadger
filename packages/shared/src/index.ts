import { z } from "zod";

export const DEFAULT_DISTANCE_TOLERANCE_METERS = 150;
export const DEFAULT_PLACE_SEARCH_LIMIT = 5;

export const activitySchema = z.enum(["running_walking", "cycling"]);
export const surfacePreferenceSchema = z.enum([
  "trail",
  "mixed",
  "asphalt",
  "indifferent",
]);
export const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export const routeStatusSchema = z.enum(["success", "partial", "failed"]);
export const routeWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export const routeSurfaceSummarySchema = z.object({
  asphaltPercent: z.number().min(0).max(100).nullable(),
  trailUnpavedPercent: z.number().min(0).max(100).nullable(),
  fieldTrackOtherPercent: z.number().min(0).max(100).nullable(),
  unknownPercent: z.number().min(0).max(100).nullable(),
});
export const routeSummarySchema = z.object({
  totalDistanceKm: z.number().positive(),
  targetDistanceKm: z.number().positive(),
  distanceDeltaMeters: z.number(),
  elevationGainMeters: z.number().nullable(),
  surface: routeSurfaceSummarySchema,
});
export const lineStringCoordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const routeGeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(lineStringCoordinateSchema).min(2),
});
export const routeInstructionSchema = z.object({
  distanceFromStartMeters: z.number().min(0),
  distanceToNextMeters: z.number().min(0).nullable(),
  type: z.string().min(1),
  text: z.string().min(1),
  streetName: z.string().min(1).nullable(),
  coordinate: lineStringCoordinateSchema,
});
export const routeGenerateRequestSchema = z.object({
  start: coordinateSchema,
  targetDistanceKm: z.number().positive(),
  activity: activitySchema,
  surfacePreference: surfacePreferenceSchema,
  passThroughPoints: z.array(coordinateSchema).default([]),
  randomSeed: z.string().min(1).nullable().default(null),
  toleranceMeters: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_DISTANCE_TOLERANCE_METERS),
});
export const routeGenerateResponseSchema = z.object({
  routeId: z.string().min(1),
  status: routeStatusSchema,
  warnings: z.array(routeWarningSchema),
  summary: routeSummarySchema.nullable(),
  geometry: routeGeometrySchema.nullable(),
  instructions: z.array(routeInstructionSchema).nullable(),
});
export const placeSearchStatusSchema = z.enum([
  "success",
  "empty",
  "unavailable",
]);
export const placeSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(10)
    .default(DEFAULT_PLACE_SEARCH_LIMIT),
});
export const placeSearchResultSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  coordinate: coordinateSchema,
});
export const placeSearchResponseSchema = z.object({
  status: placeSearchStatusSchema,
  query: z.string().min(2),
  results: z.array(placeSearchResultSchema),
  message: z.string().min(1),
});

export type Activity = z.infer<typeof activitySchema>;
export type Coordinate = z.infer<typeof coordinateSchema>;
export type SurfacePreference = z.infer<typeof surfacePreferenceSchema>;
export type RouteStatus = z.infer<typeof routeStatusSchema>;
export type RouteWarning = z.infer<typeof routeWarningSchema>;
export type RouteSurfaceSummary = z.infer<typeof routeSurfaceSummarySchema>;
export type RouteSummary = z.infer<typeof routeSummarySchema>;
export type RouteGeometry = z.infer<typeof routeGeometrySchema>;
export type RouteInstruction = z.infer<typeof routeInstructionSchema>;
export type RouteGenerateRequest = z.infer<typeof routeGenerateRequestSchema>;
export type RouteGenerateResponse = z.infer<typeof routeGenerateResponseSchema>;
export type PlaceSearchStatus = z.infer<typeof placeSearchStatusSchema>;
export type PlaceSearchRequest = z.infer<typeof placeSearchRequestSchema>;
export type PlaceSearchResult = z.infer<typeof placeSearchResultSchema>;
export type PlaceSearchResponse = z.infer<typeof placeSearchResponseSchema>;

export const activityOptions = activitySchema.options;
export const surfacePreferenceOptions = surfacePreferenceSchema.options;
export const routeStatusOptions = routeStatusSchema.options;
export const placeSearchStatusOptions = placeSearchStatusSchema.options;
