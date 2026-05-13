import { routeGenerateResponseSchema } from "@pathbadger/shared";
import type {
  RouteGenerateRequest,
  RouteGenerateResponse,
} from "@pathbadger/shared";

export interface RequestRoutePreviewOptions {
  apiBaseUrl: string;
  request: RouteGenerateRequest;
  fetchImpl?: typeof fetch;
}

export async function requestRoutePreview(
  options: RequestRoutePreviewOptions,
): Promise<RouteGenerateResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    new URL("/routes/generate", withTrailingSlash(options.apiBaseUrl)),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(options.request),
    },
  );
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new Error(getRoutePreviewErrorMessage(response, payload));
  }

  const parsedResponse = routeGenerateResponseSchema.safeParse(payload);

  if (!parsedResponse.success) {
    throw new Error("API returned an unexpected route preview payload.");
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

function getRoutePreviewErrorMessage(response: Response, payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  return `Route preview request failed with ${response.status}.`;
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
