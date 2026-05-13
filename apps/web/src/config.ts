export const DEFAULT_PUBLIC_API_BASE_URL = "http://localhost:3001";
// Keep the default local app boot self-contained. A real TileServer style can
// still override this through PUBLIC_TILE_STYLE_URL when that stack is ready.
export const DEFAULT_PUBLIC_TILE_STYLE_URL = "/styles/local-fallback.json";

export const webRuntimeConfig = {
  apiBaseUrl:
    import.meta.env.PUBLIC_API_BASE_URL ?? DEFAULT_PUBLIC_API_BASE_URL,
  regionName: import.meta.env.PUBLIC_REGION_NAME ?? "Schleswig-Holstein",
  tileStyleUrl:
    import.meta.env.PUBLIC_TILE_STYLE_URL ?? DEFAULT_PUBLIC_TILE_STYLE_URL,
} as const;
