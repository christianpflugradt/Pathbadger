import { describe, expect, it } from "vitest";

import { getNavigationHeroStatus } from "./navigation-hero-status.js";

describe("getNavigationHeroStatus", () => {
  it("marks an active session as live", () => {
    expect(
      getNavigationHeroStatus({
        canStartNavigation: true,
        isNavigationActive: true,
        isRoutePreviewStale: false,
      }),
    ).toEqual({
      label: "Navigation session live",
      statusPillClassName: "status-pill--active",
    });
  });

  it("describes supported pre-start navigation as ready after a usable preview exists", () => {
    expect(
      getNavigationHeroStatus({
        canStartNavigation: true,
        isNavigationActive: false,
        isRoutePreviewStale: false,
      }),
    ).toEqual({
      label: "Navigation ready",
      statusPillClassName: "status-pill--active",
    });
  });

  it("asks for a fresh preview when the latest route is stale", () => {
    expect(
      getNavigationHeroStatus({
        canStartNavigation: false,
        isNavigationActive: false,
        isRoutePreviewStale: true,
      }),
    ).toEqual({
      label: "Navigation needs fresh preview",
      statusPillClassName: "status-pill--warning",
    });
  });

  it("waits for a usable preview instead of calling navigation later work", () => {
    const status = getNavigationHeroStatus({
      canStartNavigation: false,
      isNavigationActive: false,
      isRoutePreviewStale: false,
    });

    expect(status).toEqual({
      label: "Navigation waits for preview",
      statusPillClassName: "status-pill--warning",
    });
    expect(status.label).not.toBe("Navigation later");
  });
});
