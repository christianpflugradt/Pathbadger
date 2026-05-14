import {
  placeSearchRequestSchema,
  routeGenerateRequestSchema,
} from "@pathbadger/shared";
import Fastify from "fastify";

import { createPlaceSearchServiceFromEnv } from "./place-search/place-search-service.js";
import type { PlaceSearchService } from "./place-search/place-search-service.js";
import { createGraphHopperAdapterFromEnv } from "./routing/graphhopper-adapter.js";
import { createRouteGenerationService } from "./routing/route-generation-service.js";
import type { RouteGenerationService } from "./routing/route-generation-service.js";

const DEFAULT_REGION_NAME = "Schleswig-Holstein";

interface CreateAppOptions {
  placeSearchService?: PlaceSearchService;
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
  const placeSearchService =
    options.placeSearchService ?? createPlaceSearchServiceFromEnv();

  app.get("/health", async () => ({
    region: process.env.REGION_NAME ?? DEFAULT_REGION_NAME,
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

  app.get("/places/search", async (request, reply) => {
    const parsedRequest = placeSearchRequestSchema.safeParse(request.query);

    if (!parsedRequest.success) {
      reply.status(400);

      return {
        error: "invalid_place_search_request",
        message:
          "Query string does not match the shared place-search contract.",
      };
    }

    return placeSearchService.searchPlaces(parsedRequest.data);
  });

  return app;
}
