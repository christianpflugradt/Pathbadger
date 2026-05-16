import { DEFAULT_DISTANCE_TOLERANCE_METERS } from "@pathbadger/shared";
import { describe, expect, it } from "vitest";

import {
  getSurfacePreferenceSectionCopy,
  getTargetDistanceSectionCopy,
} from "./planning-section-copy.js";

describe("getTargetDistanceSectionCopy", () => {
  it("describes the live distance tolerance instead of future work", () => {
    expect(getTargetDistanceSectionCopy()).toBe(
      `Set how long the round trip should feel. Small misses within about ${DEFAULT_DISTANCE_TOLERANCE_METERS} m are normal.`,
    );
  });
});

describe("getSurfacePreferenceSectionCopy", () => {
  it("describes active surface scoring instead of placeholder later work", () => {
    expect(getSurfacePreferenceSectionCopy()).toBe(
      "Choose whether the route should lean trail, mixed, or asphalt.",
    );
  });
});
