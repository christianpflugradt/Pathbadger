import {
  placeSearchRequestSchema,
  type PlaceSearchRequest,
  type PlaceSearchResponse,
  type PlaceSearchResult,
} from "@pathbadger/shared";
import { z } from "zod";

const PLACE_SEARCH_PATH = "/search";

const nominatimSearchResultSchema = z.object({
  place_id: z.union([z.string(), z.number()]).transform(String),
  osm_id: z.union([z.string(), z.number()]).transform(String).optional(),
  osm_type: z.string().min(1).optional(),
  display_name: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

const nominatimSearchResponseSchema = z.array(nominatimSearchResultSchema);

export interface PlaceSearchService {
  searchPlaces(request: PlaceSearchRequest): Promise<PlaceSearchResponse>;
}

export interface CreatePlaceSearchServiceOptions {
  fetchImpl?: typeof fetch;
  providerUrl?: string | null;
}

export function createPlaceSearchService(
  options: CreatePlaceSearchServiceOptions = {},
): PlaceSearchService {
  const fetchImpl = options.fetchImpl ?? fetch;
  const providerUrl = normalizeProviderUrl(
    options.providerUrl ?? process.env.PLACE_SEARCH_PROVIDER_URL ?? null,
  );

  return {
    async searchPlaces(request) {
      const parsedRequest = placeSearchRequestSchema.parse(request);

      if (!providerUrl) {
        return createUnavailableResponse(
          parsedRequest.query,
          "Local place search is unavailable because PLACE_SEARCH_PROVIDER_URL is not configured.",
        );
      }

      let response: Response;

      try {
        response = await fetchImpl(
          buildPlaceSearchUrl(providerUrl, parsedRequest),
        );
      } catch {
        return createUnavailableResponse(
          parsedRequest.query,
          "Local place search is unavailable because the configured provider did not respond.",
        );
      }

      if (!response.ok) {
        return createUnavailableResponse(
          parsedRequest.query,
          `Local place search is unavailable because the configured provider returned ${response.status}.`,
        );
      }

      let responseBody: unknown;

      try {
        responseBody = await response.json();
      } catch {
        return createUnavailableResponse(
          parsedRequest.query,
          "Local place search is unavailable because the configured provider returned an unexpected search payload.",
        );
      }

      const payload = nominatimSearchResponseSchema.safeParse(responseBody);

      if (!payload.success) {
        return createUnavailableResponse(
          parsedRequest.query,
          "Local place search is unavailable because the configured provider returned an unexpected search payload.",
        );
      }

      const results = payload.data.map<PlaceSearchResult>((result) => ({
        id:
          result.osm_type && result.osm_id
            ? `${result.osm_type}-${result.osm_id}`
            : `place-${result.place_id}`,
        label: result.display_name,
        coordinate: {
          lat: result.lat,
          lon: result.lon,
        },
      }));

      if (results.length === 0) {
        return {
          status: "empty",
          query: parsedRequest.query,
          results: [],
          message: `No local places matched "${parsedRequest.query}".`,
        };
      }

      return {
        status: "success",
        query: parsedRequest.query,
        results,
        message: `Found ${results.length} local place ${results.length === 1 ? "match" : "matches"}.`,
      };
    },
  };
}

export function createPlaceSearchServiceFromEnv(
  fetchImpl?: typeof fetch,
): PlaceSearchService {
  return createPlaceSearchService({
    ...(fetchImpl ? { fetchImpl } : {}),
    providerUrl: process.env.PLACE_SEARCH_PROVIDER_URL ?? null,
  });
}

function buildPlaceSearchUrl(baseUrl: string, request: PlaceSearchRequest) {
  const url = new URL(withSearchPath(baseUrl));

  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", request.query);
  url.searchParams.set("limit", String(request.limit));
  url.searchParams.set("addressdetails", "0");

  return url;
}

function withSearchPath(baseUrl: string) {
  const url = new URL(baseUrl);

  if (!url.pathname.replace(/\/+$/, "").endsWith(PLACE_SEARCH_PATH)) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}${PLACE_SEARCH_PATH}`;
  }

  return url.toString();
}

function normalizeProviderUrl(providerUrl: string | null) {
  const normalizedProviderUrl = providerUrl?.trim();

  return normalizedProviderUrl ? normalizedProviderUrl : null;
}

function createUnavailableResponse(
  query: string,
  message: string,
): PlaceSearchResponse {
  return {
    status: "unavailable",
    query,
    results: [],
    message,
  };
}
