import { describe, expect, it } from "vitest";

import { createSchleswigHolsteinSupportedRegion } from "./supported-region.js";

describe("createSchleswigHolsteinSupportedRegion", () => {
  it("accepts a known in-region coordinate and rejects a known out-of-region coordinate", () => {
    const supportedRegion = createSchleswigHolsteinSupportedRegion();

    expect(
      supportedRegion.containsCoordinate({
        lat: 53.9188,
        lon: 9.8872,
      }),
    ).toBe(true);
    expect(
      supportedRegion.containsCoordinate({
        lat: 52.52,
        lon: 13.405,
      }),
    ).toBe(false);
  });

  it("rejects route geometries that leave the supported region", () => {
    const supportedRegion = createSchleswigHolsteinSupportedRegion();

    expect(
      supportedRegion.containsRouteGeometry({
        type: "LineString",
        coordinates: [
          [9.8872, 53.9188],
          [10.1228, 54.3233],
          [9.8872, 53.9188],
        ],
      }),
    ).toBe(true);
    expect(
      supportedRegion.containsRouteGeometry({
        type: "LineString",
        coordinates: [
          [9.8872, 53.9188],
          [13.405, 52.52],
          [9.8872, 53.9188],
        ],
      }),
    ).toBe(false);
  });
});
