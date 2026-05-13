export const DEFAULT_PUBLIC_API_BASE_URL = "http://localhost:3001";
export const DEFAULT_PUBLIC_TILE_STYLE_URL =
  "http://localhost:8080/styles/basic/style.json";

export const webRuntimeConfig = {
  apiBaseUrl:
    import.meta.env.PUBLIC_API_BASE_URL ?? DEFAULT_PUBLIC_API_BASE_URL,
  regionName: import.meta.env.PUBLIC_REGION_NAME ?? "Schleswig-Holstein",
  tileStyleUrl:
    import.meta.env.PUBLIC_TILE_STYLE_URL ?? DEFAULT_PUBLIC_TILE_STYLE_URL,
} as const;
