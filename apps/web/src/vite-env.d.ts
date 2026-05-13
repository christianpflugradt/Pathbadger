/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_REGION_NAME?: string;
  readonly PUBLIC_TILE_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
