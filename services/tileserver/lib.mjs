const ROAD_HIGHWAYS = new Set([
  "living_street",
  "primary",
  "residential",
  "secondary",
  "service",
  "tertiary",
  "track",
  "trunk",
  "unclassified",
]);
const TRAIL_HIGHWAYS = new Set([
  "bridleway",
  "cycleway",
  "footway",
  "path",
  "pedestrian",
]);
const STEP_HIGHWAYS = new Set(["steps"]);
const PAVED_SURFACES = new Set([
  "asphalt",
  "compacted",
  "concrete",
  "concrete:plates",
  "fine_gravel",
  "paved",
  "paving_stones",
  "pebblestone",
  "sett",
]);
const UNPAVED_SURFACES = new Set([
  "dirt",
  "earth",
  "gravel",
  "grass",
  "ground",
  "mud",
  "rock",
  "sand",
  "unpaved",
  "woodchips",
]);
const TILE_SOURCE_ID = "basemap";
const DEFAULT_STYLE_CENTER = [9.88333, 53.9167];

export function classifySurface(surface) {
  if (typeof surface !== "string") {
    return "unknown";
  }

  const normalizedSurface = surface.trim().toLowerCase();

  if (PAVED_SURFACES.has(normalizedSurface)) {
    return "paved";
  }

  if (UNPAVED_SURFACES.has(normalizedSurface)) {
    return "unpaved";
  }

  return "unknown";
}

export function classifyWayTags(tags) {
  if (!tags || typeof tags !== "object") {
    return null;
  }

  const highway =
    typeof tags.highway === "string" ? tags.highway.trim().toLowerCase() : "";

  if (
    !highway ||
    highway === "construction" ||
    highway === "corridor" ||
    tags.area === "yes" ||
    tags.indoor === "yes"
  ) {
    return null;
  }

  if (STEP_HIGHWAYS.has(highway)) {
    return {
      highway,
      kind: "steps",
      sortOrder: 3,
      surfaceClass: "paved",
    };
  }

  if (TRAIL_HIGHWAYS.has(highway)) {
    return {
      highway,
      kind: "trail",
      sortOrder: 2,
      surfaceClass: classifySurface(tags.surface),
    };
  }

  if (ROAD_HIGHWAYS.has(highway)) {
    return {
      highway,
      kind: highway === "track" ? "trail" : "road",
      sortOrder: highway === "track" ? 2 : 1,
      surfaceClass: classifySurface(tags.surface),
    };
  }

  return null;
}

export function toFeatureProperties(tags) {
  const classification = classifyWayTags(tags);

  if (!classification) {
    return null;
  }

  return {
    ...classification,
    name: typeof tags.name === "string" && tags.name.trim() ? tags.name : null,
    surface:
      typeof tags.surface === "string" && tags.surface.trim()
        ? tags.surface.trim()
        : null,
  };
}

export function createStyleDocument(options = {}) {
  const center = options.center ?? DEFAULT_STYLE_CENTER;
  const regionLabel = options.regionLabel ?? "Bad Bramstedt starter";
  const tileUrl = resolveStyleAssetUrl({
    baseUrl: options.baseUrl ?? null,
    assetUrl: options.tileUrl ?? "/tiles/basic/{z}/{x}/{y}.pbf",
  });

  return {
    center,
    layers: [
      {
        id: "background",
        paint: {
          "background-color": "#f6f1e5",
        },
        type: "background",
      },
      {
        filter: ["==", ["get", "kind"], "road"],
        id: "roads-casing",
        paint: {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            1.4,
            12,
            2.6,
            14,
            5.2,
          ],
        },
        source: TILE_SOURCE_ID,
        "source-layer": TILE_SOURCE_ID,
        type: "line",
      },
      {
        filter: ["==", ["get", "kind"], "road"],
        id: "roads",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "match",
            ["get", "highway"],
            ["primary", "secondary", "trunk"],
            "#7f8790",
            ["tertiary", "unclassified"],
            "#9aa2aa",
            ["service"],
            "#adb4bb",
            "#8e979f",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            0.8,
            12,
            1.6,
            14,
            3.6,
          ],
        },
        source: TILE_SOURCE_ID,
        "source-layer": TILE_SOURCE_ID,
        type: "line",
      },
      {
        filter: ["==", ["get", "kind"], "trail"],
        id: "trails-casing",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f6f1e5",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            1.2,
            12,
            2.2,
            14,
            4,
          ],
        },
        source: TILE_SOURCE_ID,
        "source-layer": TILE_SOURCE_ID,
        type: "line",
      },
      {
        filter: ["==", ["get", "kind"], "trail"],
        id: "trails",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "match",
            ["get", "surfaceClass"],
            "paved",
            "#6f7b58",
            "unpaved",
            "#466734",
            "#587146",
          ],
          "line-dasharray": [1.2, 1],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9,
            0.7,
            12,
            1.4,
            14,
            2.6,
          ],
        },
        source: TILE_SOURCE_ID,
        "source-layer": TILE_SOURCE_ID,
        type: "line",
      },
      {
        filter: ["==", ["get", "kind"], "steps"],
        id: "steps",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#705a45",
          "line-dasharray": [0.6, 0.7],
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 14, 2.2],
        },
        source: TILE_SOURCE_ID,
        "source-layer": TILE_SOURCE_ID,
        type: "line",
      },
    ],
    metadata: {
      "pathbadger.region": regionLabel,
      "pathbadger.source": "OpenStreetMap",
    },
    name: `Pathbadger ${regionLabel}`,
    sources: {
      [TILE_SOURCE_ID]: {
        attribution:
          '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
        maxzoom: 14,
        minzoom: 0,
        tiles: [tileUrl],
        type: "vector",
      },
    },
    version: 8,
    zoom: 11.5,
  };
}

export function getTileSourceId() {
  return TILE_SOURCE_ID;
}

function resolveStyleAssetUrl(options) {
  if (
    typeof options.baseUrl !== "string" ||
    !options.baseUrl.trim() ||
    typeof options.assetUrl !== "string" ||
    !options.assetUrl.trim()
  ) {
    return options.assetUrl;
  }

  try {
    return new URL(options.assetUrl, options.baseUrl)
      .toString()
      .replaceAll("%7B", "{")
      .replaceAll("%7D", "}");
  } catch {
    return options.assetUrl;
  }
}
