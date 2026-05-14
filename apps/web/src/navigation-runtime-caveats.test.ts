import { describe, expect, it } from "vitest";

import {
  getNavigationRuntimeCaveats,
  getNavigationRuntimeCaveatSummary,
} from "./navigation-runtime-caveats.js";

describe("navigation runtime caveats", () => {
  it("summarizes the supported browser execution limits honestly", () => {
    expect(getNavigationRuntimeCaveatSummary()).toContain(
      "screen on and the app active",
    );
    expect(getNavigationRuntimeCaveatSummary()).toContain(
      "iPhone and PWA runtime limits",
    );
  });

  it("surfaces the key browser and PWA caveats required by the product spec", () => {
    expect(getNavigationRuntimeCaveats()).toEqual([
      {
        id: "permission",
        title: "Location permission is required",
        body: "Navigation can only follow the live route after browser geolocation permission is granted. If permission is denied or revoked, Pathbadger pauses live updates instead of pretending it still has a current fix.",
      },
      {
        id: "https",
        title: "Production geolocation needs HTTPS",
        body: "The supported local workflow can use http://localhost, but deployed browser geolocation generally requires HTTPS before iPhone-class browsers will provide reliable live position access.",
      },
      {
        id: "background",
        title: "Background behavior is limited",
        body: "iPhone browsers and installed PWAs may pause, throttle, or delay geolocation after the app loses focus or the screen locks, so the MVP assumes the screen stays on and the app remains active.",
      },
      {
        id: "wake-lock",
        title: "Wake Lock support varies",
        body: "Browsers do not guarantee Wake Lock support, and Pathbadger does not assume it can keep the device awake for you during navigation.",
      },
      {
        id: "pwa",
        title: "PWA does not equal native",
        body: "An installed PWA still inherits browser limits around permissions, background execution, and device integration, so supported behavior may differ from a native turn-by-turn app.",
      },
    ]);
  });
});
