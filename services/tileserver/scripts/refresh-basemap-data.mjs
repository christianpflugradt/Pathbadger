import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { toFeatureProperties } from "../lib.mjs";

const BAD_BRAMSTEDT_CENTER = {
  lat: 53.9167,
  lon: 9.88333,
};
const HIGHWAY_FILTER =
  "primary|secondary|tertiary|unclassified|residential|living_street|service|trunk|track|path|footway|cycleway|bridleway|pedestrian|steps";
const DEFAULT_SCOPE = process.env.PATHBADGER_TILE_DATA_SCOPE ?? "starter";
const parsedArguments = parseArguments(process.argv.slice(2));
const scope = parsedArguments.scope ?? DEFAULT_SCOPE;
const scopeOptions = getScopeOptions(scope);
const targetUrl = parsedArguments.output
  ? pathToFileURL(parsedArguments.output)
  : scopeOptions.defaultOutput;
const response = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: {
    accept: "application/json,text/plain,*/*",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "user-agent": "Pathbadger local tiles bootstrap",
  },
  body: new URLSearchParams({
    data: scopeOptions.query,
  }),
});

if (!response.ok) {
  throw new Error(
    `Overpass request failed for ${scope}: ${response.status} ${response.statusText}`,
  );
}

const payload = await response.json();
const elements = Array.isArray(payload.elements) ? payload.elements : [];
const features = elements
  .flatMap((element) => {
    if (
      element?.type !== "way" ||
      !Array.isArray(element.geometry) ||
      element.geometry.length < 2
    ) {
      return [];
    }

    const properties = toFeatureProperties(element.tags);

    if (!properties) {
      return [];
    }

    return [
      {
        geometry: {
          coordinates: element.geometry.map((coordinate) => [
            coordinate.lon,
            coordinate.lat,
          ]),
          type: "LineString",
        },
        properties: {
          ...properties,
          osmId: element.id,
        },
        type: "Feature",
      },
    ];
  })
  .sort((left, right) => {
    if (left.properties.sortOrder !== right.properties.sortOrder) {
      return left.properties.sortOrder - right.properties.sortOrder;
    }

    return left.properties.osmId - right.properties.osmId;
  });

const featureCollection = {
  features,
  type: "FeatureCollection",
};

await mkdir(new URL(".", targetUrl), {
  recursive: true,
});
await writeFile(targetUrl, JSON.stringify(featureCollection));

console.log(
  `Wrote ${features.length} ${scope} basemap features to ${targetUrl.pathname}.`,
);

function getScopeOptions(requestedScope) {
  if (requestedScope === "starter") {
    return {
      defaultOutput: new URL(
        "../../../data/tiles/bad-bramstedt-50km.geojson",
        import.meta.url,
      ),
      query: [
        "[out:json][timeout:120];",
        "(",
        `  way["highway"~"${HIGHWAY_FILTER}"](around:50000,${BAD_BRAMSTEDT_CENTER.lat},${BAD_BRAMSTEDT_CENTER.lon});`,
        ");",
        "out tags geom;",
      ].join("\n"),
    };
  }

  if (requestedScope === "schleswig_holstein") {
    return {
      defaultOutput: new URL(
        "../../../data/tiles/schleswig-holstein-basemap.geojson",
        import.meta.url,
      ),
      query: [
        "[out:json][timeout:900];",
        'area["boundary"="administrative"]["admin_level"="4"]["name"="Schleswig-Holstein"]->.searchArea;',
        "(",
        `  way["highway"~"${HIGHWAY_FILTER}"](area.searchArea);`,
        ");",
        "out tags geom;",
      ].join("\n"),
    };
  }

  throw new Error(
    `Unsupported scope "${requestedScope}". Use "starter" or "schleswig_holstein".`,
  );
}

function parseArguments(argv) {
  const parsed = {
    output: null,
    scope: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--output":
        parsed.output = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--scope":
        parsed.scope = argv[index + 1] ?? null;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return parsed;
}
