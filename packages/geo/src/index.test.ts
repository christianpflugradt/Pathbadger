import { describe, expect, it } from "vitest";

import { haversineDistanceMeters, kilometersToMeters } from "./index.js";

describe("kilometersToMeters", () => {
  it("converts kilometers to meters", () => {
    expect(kilometersToMeters(2.5)).toBe(2_500);
  });
});

describe("haversineDistanceMeters", () => {
  it("returns zero for identical coordinates", () => {
    expect(
      haversineDistanceMeters(
        { lat: 54.3233, lon: 10.1228 },
        { lat: 54.3233, lon: 10.1228 },
      ),
    ).toBe(0);
  });

  it("returns a positive distance for nearby coordinates", () => {
    expect(
      haversineDistanceMeters(
        { lat: 54.3233, lon: 10.1228 },
        { lat: 54.3291, lon: 10.1361 },
      ),
    ).toBeGreaterThan(0);
  });
});
