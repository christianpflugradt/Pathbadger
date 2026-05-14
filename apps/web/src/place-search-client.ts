import {
  DEFAULT_PLACE_SEARCH_LIMIT,
  placeSearchResponseSchema,
} from "@pathbadger/shared";
import type { PlaceSearchResponse } from "@pathbadger/shared";

export interface SearchLocalPlacesOptions {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
  limit?: number;
  query: string;
}

export async function searchLocalPlaces(
  options: SearchLocalPlacesOptions,
): Promise<PlaceSearchResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    buildPlaceSearchUrl(options.apiBaseUrl, {
      limit: options.limit ?? DEFAULT_PLACE_SEARCH_LIMIT,
      query: options.query,
    }),
  );
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new Error(getPlaceSearchErrorMessage(response, payload));
  }

  const parsedResponse = placeSearchResponseSchema.safeParse(payload);

  if (!parsedResponse.success) {
    throw new Error("API returned an unexpected local place-search payload.");
  }

  return parsedResponse.data;
}

async function parseResponsePayload(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getPlaceSearchErrorMessage(response: Response, payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return `Local place search request failed with ${response.status}.`;
}

function buildPlaceSearchUrl(
  apiBaseUrl: string,
  options: { limit: number; query: string },
) {
  const normalizedApiBaseUrl = apiBaseUrl.trim().replace(/\/+$/, "");
  const path =
    normalizedApiBaseUrl.length > 0
      ? `${normalizedApiBaseUrl}/places/search`
      : "/places/search";
  const url = new URL(path, "http://pathbadger.local");

  url.searchParams.set("query", options.query);
  url.searchParams.set("limit", String(options.limit));

  return `${url.pathname}?${url.searchParams.toString()}`;
}
