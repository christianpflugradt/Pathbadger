#!/usr/bin/env node

import { once } from "node:events";
import { createServer } from "node:http";

import { chromium } from "playwright";

const DEFAULT_TIMEOUT_MS = 10_000;
const NETWORK_SETTLE_DELAY_MS = 1_500;
const SELF_HOSTED_PASS_CAUSE = "pass";
const SUPPORTED_FAILURE_CAUSES = new Set([
  "app_unreachable",
  "invalid_style_url",
  "map_runtime_error",
  "missing_tile_data",
  "undeclared_fallback",
  "unreachable_style_json",
]);

const parsedArguments = parseArguments(process.argv.slice(2));

if (parsedArguments.help) {
  printHelp();
  process.exit(0);
}

const explicitAppUrl =
  parsedArguments.appUrl ??
  process.env.PATHBADGER_BROWSER_SMOKE_URL ??
  process.env.APP_URL ??
  null;

if (explicitAppUrl) {
  const outcome = await inspectPlanningMapTarget({
    appUrl: explicitAppUrl,
    expectedCause: parsedArguments.expectCause,
    label: parsedArguments.label ?? "live-app",
    timeoutMs: parsedArguments.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  printOutcome(outcome);
  process.exit(
    matchesExpectedCause(outcome, parsedArguments.expectCause) ? 0 : 1,
  );
}

const fixtureOutcomes = await runFixtureSuite({
  timeoutMs: parsedArguments.timeoutMs ?? DEFAULT_TIMEOUT_MS,
});

fixtureOutcomes.forEach(printOutcome);

const fixtureFailures = fixtureOutcomes.filter(
  (outcome) => !matchesExpectedCause(outcome, outcome.expectedCause),
);

if (fixtureFailures.length > 0) {
  console.error(
    `\nFixture browser smoke failed ${fixtureFailures.length} scenario(s).`,
  );
  process.exit(1);
}

console.log(
  `\nFixture browser smoke passed ${fixtureOutcomes.length} scenario(s).`,
);

async function runFixtureSuite(options) {
  const scenarios = [
    { id: "healthy-self-hosted-map", expectedCause: SELF_HOSTED_PASS_CAUSE },
    { id: "post-load-map-runtime-error", expectedCause: "map_runtime_error" },
    { id: "unreachable-style-json", expectedCause: "unreachable_style_json" },
    { id: "missing-tile-data", expectedCause: "missing_tile_data" },
    { id: "undeclared-fallback", expectedCause: "undeclared_fallback" },
  ];
  const outcomes = [];

  for (const scenario of scenarios) {
    const fixture = await createFixtureScenario(scenario.id);

    try {
      const outcome = await inspectPlanningMapTarget({
        appUrl: fixture.appUrl,
        expectedCause: scenario.expectedCause,
        label: `fixture:${scenario.id}`,
        timeoutMs: options.timeoutMs,
      });

      outcomes.push(outcome);
    } finally {
      await fixture.close();
    }
  }

  return outcomes;
}

async function inspectPlanningMapTarget(options) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const networkEvents = [];

  page.on("response", (response) => {
    networkEvents.push({
      status: response.status(),
      type: "response",
      url: response.url(),
    });
  });
  page.on("requestfailed", (request) => {
    networkEvents.push({
      errorText: request.failure()?.errorText ?? "Request failed.",
      type: "requestfailed",
      url: request.url(),
    });
  });

  try {
    await page.goto(options.appUrl, {
      timeout: options.timeoutMs,
      waitUntil: "domcontentloaded",
    });
  } catch (error) {
    await browser.close();
    return buildFailureOutcome({
      appUrl: options.appUrl,
      cause: "app_unreachable",
      detail: getErrorMessage(error),
      expectedCause: options.expectedCause ?? null,
      label: options.label,
      mapBody: "",
      mapHeading: "",
      mapLoadState: "unknown",
      styleUrl: "",
      tileRequestFailures: [],
      tileRequestSuccesses: [],
    });
  }

  try {
    const mapSection = page.getByTestId("planning-map");

    await mapSection.waitFor({ state: "visible", timeout: options.timeoutMs });

    await waitForSettledLoadState({
      locator: mapSection,
      timeoutMs: options.timeoutMs,
    });
    const initialDiagnostics = await readPlanningMapDiagnostics({
      locator: mapSection,
      page,
    });
    const styleUrlResult = resolveAndClassifyStyleUrl(
      initialDiagnostics.styleUrl,
      options.appUrl,
    );

    if (!styleUrlResult.ok) {
      return buildFailureOutcome({
        appUrl: options.appUrl,
        cause: styleUrlResult.cause,
        detail: styleUrlResult.detail,
        expectedCause: options.expectedCause ?? null,
        label: options.label,
        mapBody: initialDiagnostics.mapBody,
        mapHeading: initialDiagnostics.mapHeading,
        mapLoadState: initialDiagnostics.mapLoadState,
        styleUrl: styleUrlResult.styleUrl,
        tileRequestFailures: [],
        tileRequestSuccesses: [],
      });
    }

    const styleDocumentResult = await fetchStyleDocument(
      styleUrlResult.styleUrl,
    );

    if (!styleDocumentResult.ok) {
      return buildFailureOutcome({
        appUrl: options.appUrl,
        cause: "unreachable_style_json",
        detail: styleDocumentResult.detail,
        expectedCause: options.expectedCause ?? null,
        label: options.label,
        mapBody: initialDiagnostics.mapBody,
        mapHeading: initialDiagnostics.mapHeading,
        mapLoadState: initialDiagnostics.mapLoadState,
        styleUrl: styleUrlResult.styleUrl,
        tileRequestFailures: [],
        tileRequestSuccesses: [],
      });
    }

    const styleAudit = auditStyleDocument(
      styleDocumentResult.styleDocument,
      styleUrlResult.styleUrl,
      new URL(options.appUrl).origin,
    );

    if (!styleAudit.ok) {
      return buildFailureOutcome({
        appUrl: options.appUrl,
        cause: styleAudit.cause,
        detail: styleAudit.detail,
        expectedCause: options.expectedCause ?? null,
        label: options.label,
        mapBody: initialDiagnostics.mapBody,
        mapHeading: initialDiagnostics.mapHeading,
        mapLoadState: initialDiagnostics.mapLoadState,
        styleUrl: styleUrlResult.styleUrl,
        tileRequestFailures: [],
        tileRequestSuccesses: [],
      });
    }

    await page.waitForTimeout(NETWORK_SETTLE_DELAY_MS);

    const settledDiagnostics = await readPlanningMapDiagnostics({
      locator: mapSection,
      page,
    });
    const tileRequestSummary = summarizeTileRequests({
      networkEvents,
      requestMatchers: styleAudit.requestMatchers,
      styleUrl: styleUrlResult.styleUrl,
    });

    if (tileRequestSummary.failures.length > 0) {
      return buildFailureOutcome({
        appUrl: options.appUrl,
        cause: "missing_tile_data",
        detail: `Observed ${tileRequestSummary.failures.length} failed tile-stack request(s).`,
        expectedCause: options.expectedCause ?? null,
        label: options.label,
        mapBody: settledDiagnostics.mapBody,
        mapHeading: settledDiagnostics.mapHeading,
        mapLoadState: settledDiagnostics.mapLoadState,
        styleUrl: styleUrlResult.styleUrl,
        tileRequestFailures: tileRequestSummary.failures,
        tileRequestSuccesses: tileRequestSummary.successes,
      });
    }

    if (settledDiagnostics.mapLoadState !== "ready") {
      return buildFailureOutcome({
        appUrl: options.appUrl,
        cause: "map_runtime_error",
        detail: getMapRuntimeErrorDetail(settledDiagnostics),
        expectedCause: options.expectedCause ?? null,
        label: options.label,
        mapBody: settledDiagnostics.mapBody,
        mapHeading: settledDiagnostics.mapHeading,
        mapLoadState: settledDiagnostics.mapLoadState,
        styleUrl: styleUrlResult.styleUrl,
        tileRequestFailures: tileRequestSummary.failures,
        tileRequestSuccesses: tileRequestSummary.successes,
      });
    }

    if (tileRequestSummary.successes.length === 0) {
      return buildFailureOutcome({
        appUrl: options.appUrl,
        cause: "missing_tile_data",
        detail:
          "No successful tile-stack request was observed after the style document loaded.",
        expectedCause: options.expectedCause ?? null,
        label: options.label,
        mapBody: settledDiagnostics.mapBody,
        mapHeading: settledDiagnostics.mapHeading,
        mapLoadState: settledDiagnostics.mapLoadState,
        styleUrl: styleUrlResult.styleUrl,
        tileRequestFailures: tileRequestSummary.failures,
        tileRequestSuccesses: tileRequestSummary.successes,
      });
    }

    return {
      appUrl: options.appUrl,
      cause: SELF_HOSTED_PASS_CAUSE,
      detail: `Observed ${tileRequestSummary.successes.length} successful tile-stack request(s).`,
      expectedCause: options.expectedCause ?? null,
      label: options.label,
      mapBody: settledDiagnostics.mapBody,
      mapHeading: settledDiagnostics.mapHeading,
      mapLoadState: settledDiagnostics.mapLoadState,
      ok: true,
      styleUrl: styleUrlResult.styleUrl,
      tileRequestFailures: tileRequestSummary.failures,
      tileRequestSuccesses: tileRequestSummary.successes,
    };
  } finally {
    await browser.close();
  }
}

function buildFailureOutcome(outcome) {
  return {
    ...outcome,
    ok: false,
  };
}

async function launchBrowser() {
  const candidates = [
    {
      description: "installed Google Chrome",
      options: { channel: "chrome", headless: true },
    },
    {
      description: "bundled Playwright Chromium",
      options: { headless: true },
    },
  ];

  let lastError = null;

  for (const candidate of candidates) {
    try {
      return await chromium.launch(candidate.options);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Could not launch a Chromium browser. Install Google Chrome or run "npx playwright install chromium". ${getErrorMessage(lastError)}`,
  );
}

async function waitForSettledLoadState(options) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.timeoutMs) {
    const loadState = await options.locator.getAttribute("data-map-load-state");

    if (loadState && loadState !== "loading") {
      return loadState;
    }

    await options.locator.page().waitForTimeout(200);
  }

  return (
    (await options.locator.getAttribute("data-map-load-state")) ?? "loading"
  );
}

async function readPlanningMapDiagnostics(options) {
  return {
    mapBody: await readLocatorText(
      options.page.getByTestId("planning-map-body"),
    ),
    mapHeading: await readLocatorText(
      options.page.getByTestId("planning-map-heading"),
    ),
    mapLoadState:
      (await options.locator.getAttribute("data-map-load-state")) ?? "unknown",
    styleUrl:
      (await options.locator.getAttribute("data-map-style-url")) ??
      (await readLocatorText(options.page.getByTestId("planning-map-style"))),
  };
}

function getMapRuntimeErrorDetail(diagnostics) {
  if (diagnostics.mapBody) {
    return `The planning map reported a runtime error after the style document loaded: ${diagnostics.mapBody}`;
  }

  return "The planning map reported a runtime error after the style document loaded.";
}

function resolveAndClassifyStyleUrl(rawStyleUrl, appUrl) {
  if (!rawStyleUrl?.trim()) {
    return {
      cause: "invalid_style_url",
      detail: "The planning map did not expose a style URL.",
      ok: false,
      styleUrl: "",
    };
  }

  let resolvedStyleUrl;

  try {
    resolvedStyleUrl = new URL(rawStyleUrl, appUrl).toString();
  } catch {
    return {
      cause: "invalid_style_url",
      detail: `The planning map exposed an invalid style URL: ${rawStyleUrl}`,
      ok: false,
      styleUrl: rawStyleUrl,
    };
  }

  const appOrigin = new URL(appUrl).origin;
  const styleLocation = new URL(resolvedStyleUrl);

  if (resolvedStyleUrl.includes("local-fallback")) {
    return {
      cause: "undeclared_fallback",
      detail:
        "The planning map points at the deprecated local fallback style asset.",
      ok: false,
      styleUrl: resolvedStyleUrl,
    };
  }

  if (styleLocation.origin !== appOrigin) {
    return {
      cause: "undeclared_fallback",
      detail: `The planning map style bypasses the frontend proxy and points at ${styleLocation.origin}.`,
      ok: false,
      styleUrl: resolvedStyleUrl,
    };
  }

  return {
    ok: true,
    styleUrl: resolvedStyleUrl,
  };
}

async function fetchStyleDocument(styleUrl) {
  let response;

  try {
    response = await fetch(styleUrl);
  } catch (error) {
    return {
      detail: `Could not fetch ${styleUrl}: ${getErrorMessage(error)}`,
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      detail: `GET ${styleUrl} returned ${response.status} ${response.statusText}.`,
      ok: false,
    };
  }

  const text = await response.text();

  try {
    return {
      ok: true,
      styleDocument: JSON.parse(text),
    };
  } catch (error) {
    return {
      detail: `GET ${styleUrl} returned invalid JSON: ${getErrorMessage(error)}`,
      ok: false,
    };
  }
}

function auditStyleDocument(styleDocument, styleUrl, appOrigin) {
  if (!styleDocument || typeof styleDocument !== "object") {
    return {
      cause: "undeclared_fallback",
      detail: "The style document did not decode to an object.",
      ok: false,
    };
  }

  const sources =
    "sources" in styleDocument &&
    styleDocument.sources &&
    typeof styleDocument.sources === "object"
      ? Object.values(styleDocument.sources)
      : [];
  const requestUrls = [];

  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    if (
      "tiles" in source &&
      Array.isArray(source.tiles) &&
      source.tiles.every((tileUrl) => typeof tileUrl === "string")
    ) {
      requestUrls.push(
        ...source.tiles.map((tileUrl) =>
          resolveTemplatedUrl(tileUrl, styleUrl),
        ),
      );
    }

    if ("url" in source && typeof source.url === "string") {
      requestUrls.push(resolveTemplatedUrl(source.url, styleUrl));
    }
  }

  if (requestUrls.length === 0) {
    return {
      cause: "undeclared_fallback",
      detail:
        "The style document does not reference any tile-backed local sources.",
      ok: false,
    };
  }

  for (const requestUrl of requestUrls) {
    const requestLocation = new URL(requestUrl);

    if (requestLocation.origin !== appOrigin) {
      return {
        cause: "undeclared_fallback",
        detail: `The style document bypasses the frontend proxy and references ${requestLocation.origin}.`,
        ok: false,
      };
    }

    if (requestUrl.includes("local-fallback")) {
      return {
        cause: "undeclared_fallback",
        detail:
          "The style document still references the deprecated local fallback asset path.",
        ok: false,
      };
    }
  }

  return {
    ok: true,
    requestMatchers: requestUrls.map((requestUrl) => {
      const requestLocation = new URL(requestUrl);
      const decodedPathname = decodeURIComponent(requestLocation.pathname);
      const templateMarkerIndex = decodedPathname.indexOf("{");

      return {
        origin: requestLocation.origin,
        pathPrefix:
          templateMarkerIndex >= 0
            ? decodedPathname.slice(0, templateMarkerIndex)
            : decodedPathname,
      };
    }),
  };
}

function resolveTemplatedUrl(assetUrl, baseUrl) {
  return new URL(assetUrl, baseUrl)
    .toString()
    .replaceAll("%7B", "{")
    .replaceAll("%7D", "}");
}

function summarizeTileRequests(options) {
  const styleUrl = options.styleUrl;
  const failures = [];
  const successes = [];

  for (const event of options.networkEvents) {
    const eventUrl = new URL(event.url);

    if (
      event.url === styleUrl ||
      !options.requestMatchers.some(
        (requestMatcher) =>
          requestMatcher.origin === eventUrl.origin &&
          eventUrl.pathname.startsWith(requestMatcher.pathPrefix),
      )
    ) {
      continue;
    }

    if (event.type === "requestfailed") {
      failures.push(`${event.url} (${event.errorText})`);
      continue;
    }

    if (event.status >= 400) {
      failures.push(`${event.url} (${event.status})`);
      continue;
    }

    successes.push(`${event.url} (${event.status})`);
  }

  return { failures, successes };
}

function matchesExpectedCause(outcome, expectedCause) {
  if (!expectedCause) {
    return outcome.ok;
  }

  return outcome.cause === expectedCause;
}

function printOutcome(outcome) {
  const status = matchesExpectedCause(outcome, outcome.expectedCause)
    ? "PASS"
    : "FAIL";
  const expectation = outcome.expectedCause
    ? ` expected=${outcome.expectedCause}`
    : "";

  console.log(`\n[${status}] ${outcome.label}${expectation}`);
  console.log(`  Cause: ${outcome.cause}`);
  console.log(`  App URL: ${outcome.appUrl}`);
  console.log(`  Map state: ${outcome.mapLoadState}`);
  console.log(`  Heading: ${outcome.mapHeading || "(none)"}`);
  console.log(`  Style: ${outcome.styleUrl || "(none)"}`);
  console.log(`  Detail: ${outcome.detail}`);

  if (outcome.mapBody) {
    console.log(`  Body: ${outcome.mapBody}`);
  }

  if (outcome.tileRequestSuccesses.length > 0) {
    console.log(`  Tile requests ok: ${outcome.tileRequestSuccesses.length}`);
  }

  if (outcome.tileRequestFailures.length > 0) {
    console.log(
      `  Tile requests failed: ${outcome.tileRequestFailures.length}`,
    );
    outcome.tileRequestFailures.slice(0, 3).forEach((failure) => {
      console.log(`    - ${failure}`);
    });
  }
}

function parseArguments(argv) {
  const parsed = {
    appUrl: null,
    expectCause: null,
    help: false,
    label: null,
    timeoutMs: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--app-url":
        parsed.appUrl = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--expect-cause":
        parsed.expectCause = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--label":
        parsed.label = argv[index + 1] ?? null;
        index += 1;
        break;
      case "--timeout-ms":
        parsed.timeoutMs = Number.parseInt(argv[index + 1] ?? "", 10);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (
    parsed.expectCause !== null &&
    parsed.expectCause !== SELF_HOSTED_PASS_CAUSE &&
    !SUPPORTED_FAILURE_CAUSES.has(parsed.expectCause)
  ) {
    throw new Error(`Unsupported --expect-cause value: ${parsed.expectCause}.`);
  }

  if (
    parsed.timeoutMs !== null &&
    (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0)
  ) {
    throw new Error(`Unsupported --timeout-ms value: ${parsed.timeoutMs}.`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Pathbadger browser smoke

Usage:
  npm run test:browser-smoke
  npm run test:browser-smoke -- --app-url http://localhost:5173
  npm run test:browser-smoke -- --app-url http://localhost:5173 --expect-cause unreachable_style_json

Without --app-url, the command runs a fixture-backed suite that proves the smoke
can distinguish a healthy self-hosted map from unreachable style JSON, missing
tile data, post-load map runtime errors, and proxy-bypassing fallback paths.`);
}

async function readLocatorText(locator) {
  const text = await locator.textContent();

  return text?.trim() ?? "";
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return String(error);
}

async function createFixtureScenario(id) {
  const scenario = {
    appState: "ready",
    appStatusBody: "Fixture planning map state.",
    appStatusHeading: "Planning map is live",
    appStyleStatus: 200,
    appTileStatus: 200,
    expectedCause: SELF_HOSTED_PASS_CAUSE,
    styleDocument: {},
  };
  const mapServer = await startFixtureServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");

    if (pathname === "/styles/basic/style.json") {
      respondJson(response, 200, scenario.styleDocument);
      return;
    }

    if (pathname === "/tiles/basic/0/0/0.pbf") {
      if (id === "missing-tile-data") {
        respondText(response, 404, "Missing tile artifact.");
        return;
      }

      respondBuffer(response, 200, Buffer.from("fixture-vector-tile"));
      return;
    }

    respondText(response, 404, "Not found.");
  });

  const mapOrigin = `http://127.0.0.1:${mapServer.port}`;

  if (id === "healthy-self-hosted-map") {
    scenario.styleDocument = {
      sources: {
        base: {
          tiles: ["/tiles/basic/0/0/0.pbf"],
          type: "vector",
        },
      },
      version: 8,
    };
  }

  if (id === "post-load-map-runtime-error") {
    scenario.runtimeErrorAfterReady = true;
    scenario.runtimeErrorBody =
      "The style document loaded, but a later tile or source error forced the planning map out of the ready state.";
    scenario.runtimeErrorHeading = "Self-hosted map unavailable";
    scenario.styleDocument = {
      sources: {
        base: {
          tiles: ["/tiles/basic/0/0/0.pbf"],
          type: "vector",
        },
      },
      version: 8,
    };
  }

  if (id === "unreachable-style-json") {
    scenario.appState = "error";
    scenario.appStatusBody =
      "Could not load the self-hosted style document because it returned 404.";
    scenario.appStatusHeading = "Self-hosted map unavailable";
    scenario.appStyleStatus = 404;
  }

  if (id === "missing-tile-data") {
    scenario.appTileStatus = 404;
    scenario.styleDocument = {
      sources: {
        base: {
          tiles: ["/tiles/basic/0/0/0.pbf"],
          type: "vector",
        },
      },
      version: 8,
    };
  }

  const appServer = await startFixtureServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/") {
      const styleUrl =
        id === "undeclared-fallback"
          ? `${mapOrigin}/styles/basic/style.json`
          : "/styles/basic/style.json";
      const html = renderFixturePage({
        loadState: scenario.appState,
        runtimeErrorAfterReady: scenario.runtimeErrorAfterReady ?? false,
        runtimeErrorBody: scenario.runtimeErrorBody ?? "",
        runtimeErrorHeading: scenario.runtimeErrorHeading ?? "",
        statusBody: scenario.appStatusBody,
        statusHeading: scenario.appStatusHeading,
        styleUrl,
      });

      respondHtml(response, 200, html);
      return;
    }

    if (requestUrl.pathname === "/styles/basic/style.json") {
      respondJson(response, scenario.appStyleStatus, scenario.styleDocument);
      return;
    }

    if (requestUrl.pathname === "/tiles/basic/0/0/0.pbf") {
      if (scenario.appTileStatus !== 200) {
        respondText(response, scenario.appTileStatus, "Missing tile artifact.");
        return;
      }

      respondBuffer(response, 200, Buffer.from("fixture-vector-tile"));
      return;
    }

    respondText(response, 404, "Not found.");
  });

  return {
    appUrl: `http://127.0.0.1:${appServer.port}/`,
    async close() {
      await Promise.all([appServer.close(), mapServer.close()]);
    },
  };
}

function renderFixturePage(options) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pathbadger browser smoke fixture</title>
  </head>
  <body>
    <section
      aria-label="Planning map"
      data-map-load-state="${options.loadState}"
      data-map-style-url="${options.styleUrl}"
      data-testid="planning-map"
    >
      <div role="status" aria-live="polite">
        <p>Live MapLibre surface</p>
        <h3 data-testid="planning-map-heading">${options.statusHeading}</h3>
        <p data-testid="planning-map-body">${options.statusBody}</p>
        <p>
          <code data-testid="planning-map-style">${options.styleUrl}</code>
        </p>
      </div>
    </section>
    <script>
      window.addEventListener("load", () => {
        fetch("/tiles/basic/0/0/0.pbf").catch(() => {})
        if (${options.runtimeErrorAfterReady ? "true" : "false"}) {
          window.setTimeout(() => {
            const mapSection = document.querySelector('[data-testid="planning-map"]')
            const mapHeading = document.querySelector('[data-testid="planning-map-heading"]')
            const mapBody = document.querySelector('[data-testid="planning-map-body"]')

            mapSection?.setAttribute("data-map-load-state", "error")

            if (mapHeading) {
              mapHeading.textContent = ${JSON.stringify(options.runtimeErrorHeading)}
            }

            if (mapBody) {
              mapBody.textContent = ${JSON.stringify(options.runtimeErrorBody)}
            }
          }, 100)
        }
      })
    </script>
  </body>
</html>`;
}

async function startFixtureServer(handler) {
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    handler(request, response);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Fixture server did not expose a TCP port.");
  }

  return {
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
    port: address.port,
  };
}

function respondBuffer(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Length": body.length,
    "Content-Type": "application/x-protobuf",
  });
  response.end(body);
}

function respondHtml(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(body);
}

function respondJson(response, statusCode, body) {
  const payload = JSON.stringify(body);

  response.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(payload),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(payload);
}

function respondText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}
