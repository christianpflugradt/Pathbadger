import { describe, expect, it } from "vitest";

import {
  DEFAULT_PUBLIC_API_BASE_URL,
  DEFAULT_PUBLIC_TILE_STYLE_URL,
  resolvePublicApiBaseUrl,
  resolvePublicTileStyleUrl,
} from "./config";

describe("resolvePublicApiBaseUrl", () => {
  it("defaults to the frontend-proxied same-origin api path", () => {
    expect(DEFAULT_PUBLIC_API_BASE_URL).toBe("/api");
    expect(resolvePublicApiBaseUrl(undefined)).toBe(
      DEFAULT_PUBLIC_API_BASE_URL,
    );
  });

  it("treats blank values as missing and keeps the frontend proxy default", () => {
    expect(resolvePublicApiBaseUrl("")).toBe(DEFAULT_PUBLIC_API_BASE_URL);
    expect(resolvePublicApiBaseUrl("   ")).toBe(DEFAULT_PUBLIC_API_BASE_URL);
  });

  it("preserves an explicit same-origin api path", () => {
    expect(resolvePublicApiBaseUrl("/api")).toBe("/api");
    expect(resolvePublicApiBaseUrl("/custom-api/")).toBe("/custom-api/");
  });

  it("rejects absolute browser api urls because the frontend proxy is required", () => {
    expect(() => resolvePublicApiBaseUrl("http://localhost:3001/api")).toThrow(
      /same-origin/i,
    );
    expect(() => resolvePublicApiBaseUrl("//localhost:3001/api")).toThrow(
      /same-origin/i,
    );
  });

  it("rejects non-root-relative api paths", () => {
    expect(() => resolvePublicApiBaseUrl("api")).toThrow(/starts with '\//i);
  });
});

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
