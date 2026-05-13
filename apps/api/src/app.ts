import { routeGenerateRequestSchema } from "@pathbadger/shared";
import Fastify from "fastify";

import { createGraphHopperAdapterFromEnv } from "./routing/graphhopper-adapter.js";
import { createRouteGenerationService } from "./routing/route-generation-service.js";
import type { RouteGenerationService } from "./routing/route-generation-service.js";

interface CreateAppOptions {
  routeGenerationService?: RouteGenerationService;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({
    logger: true,
  });
  const routeGenerationService =
    options.routeGenerationService ??
    createRouteGenerationService({
      routingEngine: createGraphHopperAdapterFromEnv(),
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
