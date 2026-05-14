import { DEFAULT_DISTANCE_TOLERANCE_METERS } from "@pathbadger/shared";

export function getTargetDistanceSectionCopy() {
  return `Requests stay in kilometers, and preview scoring already applies the ${DEFAULT_DISTANCE_TOLERANCE_METERS} m distance tolerance.`;
}

export function getSurfacePreferenceSectionCopy() {
  return "Surface preference already influences routed candidate scoring and the routed surface summary when coverage data is available.";
}
