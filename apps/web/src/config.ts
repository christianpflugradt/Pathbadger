export const DEFAULT_PUBLIC_API_BASE_URL = "/api";
export const DEFAULT_PUBLIC_TILE_STYLE_URL = "/styles/basic/style.json";

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i;

export function resolvePublicTileStyleUrl(
  rawStyleUrl: string | undefined,
): string {
  const trimmedStyleUrl = rawStyleUrl?.trim();

  return trimmedStyleUrl?.length
    ? trimmedStyleUrl
    : DEFAULT_PUBLIC_TILE_STYLE_URL;
}

export function resolvePublicApiBaseUrl(rawApiBaseUrl: string | undefined) {
  const trimmedApiBaseUrl = rawApiBaseUrl?.trim();

  if (!trimmedApiBaseUrl?.length) {
    return DEFAULT_PUBLIC_API_BASE_URL;
  }

  if (
    ABSOLUTE_URL_PATTERN.test(trimmedApiBaseUrl) ||
    trimmedApiBaseUrl.startsWith("//")
  ) {
    throw new Error(
      "PUBLIC_API_BASE_URL must stay same-origin, for example /api. Absolute browser API URLs are unsupported because the frontend proxy is the supported routing boundary.",
    );
  }

  if (!trimmedApiBaseUrl.startsWith("/")) {
    throw new Error(
      "PUBLIC_API_BASE_URL must be a same-origin path that starts with '/', for example /api.",
    );
  }

  return trimmedApiBaseUrl;
}

export const webRuntimeConfig = {
  apiBaseUrl: resolvePublicApiBaseUrl(import.meta.env.PUBLIC_API_BASE_URL),
  regionName: import.meta.env.PUBLIC_REGION_NAME ?? "Schleswig-Holstein",
  tileStyleUrl: resolvePublicTileStyleUrl(
    import.meta.env.PUBLIC_TILE_STYLE_URL,
  ),
} as const;
