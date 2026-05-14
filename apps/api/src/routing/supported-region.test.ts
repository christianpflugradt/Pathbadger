import { describe, expect, it } from "vitest";

import {
  createSchleswigHolsteinSupportedRegion,
  createSupportedRegion,
} from "./supported-region.js";

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

describe("createSupportedRegion", () => {
  it("rejects a segment that crosses an unsupported hole even when both vertices stay inside the outer ring", () => {
    const supportedRegion = createSupportedRegion({
      name: "holed-test-region",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
          [
            [1, 1],
            [3, 1],
            [3, 3],
            [1, 3],
            [1, 1],
          ],
        ],
      },
    });

    expect(
      supportedRegion.containsRouteGeometry({
        type: "LineString",
        coordinates: [
          [0.5, 2],
          [3.5, 2],
        ],
      }),
    ).toBe(false);
  });

  it("rejects a segment that cuts across a concave gap between inside vertices", () => {
    const supportedRegion = createSupportedRegion({
      name: "concave-test-region",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 1],
            [1, 1],
            [1, 4],
            [0, 4],
            [0, 0],
          ],
        ],
      },
    });

    expect(
      supportedRegion.containsRouteGeometry({
        type: "LineString",
        coordinates: [
          [0.5, 3.5],
          [3.5, 0.5],
        ],
      }),
    ).toBe(false);
  });

  it("accepts segments that route around a hole without crossing it", () => {
    const supportedRegion = createSupportedRegion({
      name: "holed-test-region",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
          [
            [1, 1],
            [3, 1],
            [3, 3],
            [1, 3],
            [1, 1],
          ],
        ],
      },
    });

    expect(
      supportedRegion.containsRouteGeometry({
        type: "LineString",
        coordinates: [
          [0.5, 2],
          [0.5, 3.5],
          [3.5, 3.5],
        ],
      }),
    ).toBe(true);
  });
});
