import { describe, expect, it } from "vitest";

import {
  DEFAULT_PUBLIC_TILE_STYLE_URL,
  resolvePublicTileStyleUrl,
} from "./config";

describe("resolvePublicTileStyleUrl", () => {
  it("defaults to the frontend-proxied self-hosted style endpoint", () => {
    expect(DEFAULT_PUBLIC_TILE_STYLE_URL).toBe("/styles/basic/style.json");
    expect(resolvePublicTileStyleUrl(undefined)).toBe(
      DEFAULT_PUBLIC_TILE_STYLE_URL,
    );
  });

  it("treats blank values as missing instead of routing to a fallback asset", () => {
    expect(resolvePublicTileStyleUrl("")).toBe(DEFAULT_PUBLIC_TILE_STYLE_URL);
    expect(resolvePublicTileStyleUrl("   ")).toBe(
      DEFAULT_PUBLIC_TILE_STYLE_URL,
    );
  });

  it("preserves an explicit self-hosted style URL", () => {
    expect(resolvePublicTileStyleUrl("/styles/custom/style.json")).toBe(
      "/styles/custom/style.json",
    );
  });
});
