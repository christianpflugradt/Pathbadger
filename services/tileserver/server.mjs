import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import geojsonvt from "geojson-vt";
import vtpbf from "vt-pbf";

import { createStyleDocument, getTileSourceId } from "./lib.mjs";

const DATA_SCOPE = process.env.PATHBADGER_TILE_DATA_SCOPE ?? "starter";
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const TILE_SOURCE_ID = getTileSourceId();
const DATASET_URL = resolveDatasetUrl({
  dataFile: process.env.PATHBADGER_TILE_DATA_FILE ?? null,
  scope: DATA_SCOPE,
});
const EMPTY_TILE = vtpbf.fromGeojsonVt({
  [TILE_SOURCE_ID]: {
    extent: 4096,
    features: [],
    numFeatures: 0,
    numPoints: 0,
    numSimplified: 0,
  },
});

const datasetText = await readFile(DATASET_URL, "utf8");
const { featureCount, tileIndex } = buildTileIndex(datasetText);

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  const { pathname } = requestUrl;

  if (pathname === "/health") {
    respondJson(response, 200, {
      featureCount,
      scope: DATA_SCOPE,
      service: "tileserver",
      status: "ok",
    });
    return;
  }

  if (pathname === "/styles/basic/style.json") {
    respondJson(
      response,
      200,
      createStyleDocument({
        baseUrl: getRequestOrigin(request),
        regionLabel:
          DATA_SCOPE === "schleswig_holstein"
            ? "Schleswig-Holstein basemap"
            : "Bad Bramstedt 50 km starter",
      }),
    );
    return;
  }

  const tileMatch = pathname.match(
    /^\/tiles\/basic\/(\d+)\/(\d+)\/(\d+)\.pbf$/,
  );

  if (tileMatch) {
    const [, rawZ, rawX, rawY] = tileMatch;
    const z = Number.parseInt(rawZ, 10);
    const x = Number.parseInt(rawX, 10);
    const y = Number.parseInt(rawY, 10);
    const tile = tileIndex.getTile(z, x, y);
    const tileBuffer = tile
      ? vtpbf.fromGeojsonVt({ [TILE_SOURCE_ID]: tile })
      : EMPTY_TILE;

    response.writeHead(200, {
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(tileBuffer.length),
      "Content-Type": "application/vnd.mapbox-vector-tile",
    });
    response.end(tileBuffer);
    return;
  }

  respondJson(response, 404, {
    error: "Not found.",
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `Pathbadger tile service ready on http://${HOST}:${PORT} with ${featureCount} features from ${DATA_SCOPE}.`,
  );
});

function resolveDatasetUrl(options) {
  if (options.dataFile?.trim()) {
    return pathToFileURL(options.dataFile);
  }

  if (options.scope === "starter") {
    return new URL("file:///runtime-data/bad-bramstedt-50km.geojson");
  }

  if (options.scope === "schleswig_holstein") {
    return new URL("file:///runtime-data/schleswig-holstein-basemap.geojson");
  }

  throw new Error(
    `Unsupported PATHBADGER_TILE_DATA_SCOPE "${options.scope}". Use "starter" or "schleswig_holstein".`,
  );
}

function respondJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Content-Length": String(Buffer.byteLength(body)),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function getRequestOrigin(request) {
  const forwardedProtocolHeader = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocolHeader)
    ? forwardedProtocolHeader[0]
    : forwardedProtocolHeader?.split(",")[0];
  const host = request.headers.host?.trim() || `127.0.0.1:${PORT}`;

  return `${protocol?.trim() || "http"}://${host}`;
}

function buildTileIndex(datasetText) {
  const dataset = JSON.parse(datasetText);
  const featureCount = Array.isArray(dataset.features)
    ? dataset.features.length
    : 0;
  const tileIndex = geojsonvt(dataset, {
    buffer: 64,
    extent: 4096,
    indexMaxPoints: 0,
    indexMaxZoom: 14,
    lineMetrics: false,
    maxZoom: 14,
    tolerance: 3,
  });

  return {
    featureCount,
    tileIndex,
  };
}
