import { DEFAULT_DISTANCE_TOLERANCE_METERS } from "@pathbadger/shared";

export function getTargetDistanceSectionCopy() {
  return `Set how long the round trip should feel. Small misses within about ${DEFAULT_DISTANCE_TOLERANCE_METERS} m are normal.`;
}

export function getSurfacePreferenceSectionCopy() {
  return "Choose whether the route should lean trail, mixed, or asphalt.";
}
