import { DEFAULT_DISTANCE_TOLERANCE_METERS } from "@pathbadger/shared";
import { describe, expect, it } from "vitest";

import {
  getSurfacePreferenceSectionCopy,
  getTargetDistanceSectionCopy,
} from "./planning-section-copy.js";

describe("getTargetDistanceSectionCopy", () => {
  it("describes the live distance tolerance instead of future work", () => {
    expect(getTargetDistanceSectionCopy()).toBe(
      `Requests stay in kilometers, and preview scoring already applies the ${DEFAULT_DISTANCE_TOLERANCE_METERS} m distance tolerance.`,
    );
  });
});

describe("getSurfacePreferenceSectionCopy", () => {
  it("describes active surface scoring instead of placeholder later work", () => {
    expect(getSurfacePreferenceSectionCopy()).toBe(
      "Surface preference already influences routed candidate scoring and the routed surface summary when coverage data is available.",
    );
  });
});
