import { z } from "zod";

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

export type Activity = z.infer<typeof activitySchema>;
export type Coordinate = z.infer<typeof coordinateSchema>;
export type SurfacePreference = z.infer<typeof surfacePreferenceSchema>;

export const activityOptions = activitySchema.options;
export const surfacePreferenceOptions = surfacePreferenceSchema.options;
