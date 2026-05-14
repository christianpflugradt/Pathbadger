import { describe, expect, it } from "vitest";

import {
  classifySurface,
  classifyWayTags,
  createStyleDocument,
} from "./lib.mjs";

describe("classifySurface", () => {
  it("marks paved and unpaved surfaces explicitly", () => {
    expect(classifySurface("asphalt")).toBe("paved");
    expect(classifySurface("earth")).toBe("unpaved");
    expect(classifySurface("wood")).toBe("unknown");
  });
});

describe("classifyWayTags", () => {
  it("treats residential streets as roads", () => {
    expect(
      classifyWayTags({
        highway: "residential",
        surface: "asphalt",
      }),
    ).toEqual({
      highway: "residential",
      kind: "road",
      sortOrder: 1,
      surfaceClass: "paved",
    });
  });

  it("keeps footways and tracks in the trail styling path", () => {
    expect(
      classifyWayTags({
        highway: "footway",
        surface: "earth",
      }),
    ).toEqual({
      highway: "footway",
      kind: "trail",
      sortOrder: 2,
      surfaceClass: "unpaved",
    });
    expect(
      classifyWayTags({
        highway: "track",
      }),
    ).toEqual({
      highway: "track",
      kind: "trail",
      sortOrder: 2,
      surfaceClass: "unknown",
    });
  });

  it("ignores indoor corridors and unsupported highway tags", () => {
    expect(
      classifyWayTags({
        highway: "corridor",
      }),
    ).toBeNull();
    expect(
      classifyWayTags({
        highway: "footway",
        indoor: "yes",
      }),
    ).toBeNull();
  });
});

describe("createStyleDocument", () => {
  it("resolves the served tile path against the supported app origin", () => {
    const style = createStyleDocument({
      baseUrl: "http://localhost:5173/styles/basic/style.json",
    });

    expect(style.sources.basemap.tiles).toEqual([
      "http://localhost:5173/tiles/basic/{z}/{x}/{y}.pbf",
    ]);
  });

  it("keeps an explicit absolute tile service path unchanged", () => {
    const style = createStyleDocument({
      regionLabel: "Bad Bramstedt 50 km starter",
      tileUrl: "http://localhost:8080/tiles/basic/{z}/{x}/{y}.pbf",
    });

    expect(style.version).toBe(8);
    expect(style.metadata["pathbadger.region"]).toBe(
      "Bad Bramstedt 50 km starter",
    );
    expect(style.sources.basemap.tiles).toEqual([
      "http://localhost:8080/tiles/basic/{z}/{x}/{y}.pbf",
    ]);
    expect(style.layers.every((layer) => layer.id)).toBe(true);
  });
});
