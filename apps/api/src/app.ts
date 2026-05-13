import { routeGenerateRequestSchema } from "@pathbadger/shared";
import Fastify from "fastify";

import { createGraphHopperAdapterFromEnv } from "./routing/graphhopper-adapter.js";
import { createRouteGenerationService } from "./routing/route-generation-service.js";
import type { RouteGenerationService } from "./routing/route-generation-service.js";

const DEFAULT_ALLOWED_WEB_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

interface CreateAppOptions {
  routeGenerationService?: RouteGenerationService;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({
    logger: true,
  });
  const allowedOrigins = createAllowedOrigins();
  const routeGenerationService =
    options.routeGenerationService ??
    createRouteGenerationService({
      routingEngine: createGraphHopperAdapterFromEnv(),
    });

  app.addHook("onRequest", async (request, reply) => {
    const requestOrigin = request.headers.origin;

    if (requestOrigin && allowedOrigins.has(normalizeOrigin(requestOrigin))) {
      reply.header("access-control-allow-origin", requestOrigin);
      reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
      reply.header("access-control-allow-headers", "content-type");
      reply.header("vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      reply.code(204);
      return reply.send();
    }
  });

  app.get("/health", async () => ({
    region: "Schleswig-Holstein",
    service: "api",
    status: "ok",
  }));

  app.post("/routes/generate", async (request, reply) => {
    const parsedRequest = routeGenerateRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.status(400);

      return {
        error: "invalid_route_generate_request",
        message: "Request body does not match the shared route contract.",
      };
    }

    return routeGenerationService.generateRoute(parsedRequest.data);
  });

  return app;
}

function createAllowedOrigins() {
  const configuredOrigins = (process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  return new Set([
    ...DEFAULT_ALLOWED_WEB_ORIGINS.map((origin) => normalizeOrigin(origin)),
    ...configuredOrigins,
  ]);
}

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}
