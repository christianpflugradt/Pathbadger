export const DEFAULT_PUBLIC_API_BASE_URL = "/api";
export const DEFAULT_PUBLIC_TILE_STYLE_URL = "/styles/basic/style.json";

export function resolvePublicTileStyleUrl(
  rawStyleUrl: string | undefined,
): string {
  const trimmedStyleUrl = rawStyleUrl?.trim();

  return trimmedStyleUrl?.length
    ? trimmedStyleUrl
    : DEFAULT_PUBLIC_TILE_STYLE_URL;
}

export const webRuntimeConfig = {
  apiBaseUrl:
    import.meta.env.PUBLIC_API_BASE_URL ?? DEFAULT_PUBLIC_API_BASE_URL,
  regionName: import.meta.env.PUBLIC_REGION_NAME ?? "Schleswig-Holstein",
  tileStyleUrl: resolvePublicTileStyleUrl(
    import.meta.env.PUBLIC_TILE_STYLE_URL,
  ),
} as const;
