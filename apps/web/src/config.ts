export const DEFAULT_PUBLIC_TILE_STYLE_URL =
  "http://localhost:8080/styles/basic/style.json";

export const webRuntimeConfig = {
  regionName: import.meta.env.PUBLIC_REGION_NAME ?? "Schleswig-Holstein",
  tileStyleUrl:
    import.meta.env.PUBLIC_TILE_STYLE_URL ?? DEFAULT_PUBLIC_TILE_STYLE_URL,
} as const;
