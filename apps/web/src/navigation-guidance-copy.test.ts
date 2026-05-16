import { describe, expect, it } from "vitest";

import {
  getCompactNavigationGpsStatusLabel,
  getCompactNavigationInstructionTitle,
} from "./navigation-guidance-copy";

describe("getCompactNavigationInstructionTitle", () => {
  it("keeps turn guidance brief when GraphHopper adds generic toward copy", () => {
    expect(
      getCompactNavigationInstructionTitle({
        distanceFromStartMeters: 10,
        distanceToNextMeters: 40,
        type: "turn_right",
        text: "Turn right onto Heidmoorer StraBe and drive toward Lentfohrden, Heidkaten, Heidmoor",
        streetName: "Heidmoorer StraBe",
        coordinate: [9.8, 53.9],
      }),
    ).toBe("Turn right onto Heidmoorer StraBe");
  });

  it("falls back to a trimmed instruction when there is no street name", () => {
    expect(
      getCompactNavigationInstructionTitle({
        distanceFromStartMeters: 10,
        distanceToNextMeters: 40,
        type: "custom",
        text: "Continue and drive toward the village center",
        streetName: null,
        coordinate: [9.8, 53.9],
      }),
    ).toBe("Continue");
  });
});

describe("getCompactNavigationGpsStatusLabel", () => {
  it("uses the reported accuracy instead of generic warning prose", () => {
    expect(
      getCompactNavigationGpsStatusLabel({
        accuracyMeters: 40.2,
        ageMs: 3_000,
        isAccuracyBroad: true,
        isStale: false,
      }),
    ).toBe("GPS 40 m");
  });

  it("falls back to age when the fix is stale but no accuracy value exists", () => {
    expect(
      getCompactNavigationGpsStatusLabel({
        accuracyMeters: null,
        ageMs: 7_400,
        isAccuracyBroad: false,
        isStale: true,
      }),
    ).toBe("GPS 7 s old");
  });
});
