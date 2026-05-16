import { describe, expect, it, vi } from "vitest";

import {
  isPathbadgerStandaloneDisplayMode,
  isPathbadgerTrustedOrigin,
  registerPathbadgerServiceWorker,
  supportsPathbadgerServiceWorkerRuntime,
} from "./pwa-runtime.js";

describe("pwa runtime", () => {
  it("treats secure contexts and localhost variants as trusted origins", () => {
    expect(
      isPathbadgerTrustedOrigin({
        hostname: "pathbadger.example",
        isSecureContext: true,
      }),
    ).toBe(true);
    expect(
      isPathbadgerTrustedOrigin({
        hostname: "localhost",
        isSecureContext: false,
      }),
    ).toBe(true);
    expect(
      isPathbadgerTrustedOrigin({
        hostname: "dev.whatever.localhost",
        isSecureContext: false,
      }),
    ).toBe(true);
    expect(
      isPathbadgerTrustedOrigin({
        hostname: "192.168.1.22",
        isSecureContext: false,
      }),
    ).toBe(false);
  });

  it("detects standalone display mode from media queries or legacy iOS navigator state", () => {
    expect(
      isPathbadgerStandaloneDisplayMode({
        matchMedia: () => ({ matches: true }),
      }),
    ).toBe(true);
    expect(
      isPathbadgerStandaloneDisplayMode({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      }),
    ).toBe(true);
    expect(
      isPathbadgerStandaloneDisplayMode({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: false },
      }),
    ).toBe(false);
  });

  it("only enables service worker registration on supported trusted runtimes", () => {
    expect(
      supportsPathbadgerServiceWorkerRuntime({
        hostname: "localhost",
        isSecureContext: false,
        navigator: {
          serviceWorker: {
            register: vi.fn(),
          },
        },
      }),
    ).toBe(true);
    expect(
      supportsPathbadgerServiceWorkerRuntime({
        hostname: "192.168.1.22",
        isSecureContext: false,
        navigator: {
          serviceWorker: {
            register: vi.fn(),
          },
        },
      }),
    ).toBe(false);
    expect(
      supportsPathbadgerServiceWorkerRuntime({
        hostname: "pathbadger.example",
        isSecureContext: true,
        navigator: {},
      }),
    ).toBe(false);
  });

  it("registers the pathbadger service worker at the root scope", async () => {
    const register = vi.fn().mockResolvedValue({ scope: "/" });

    await expect(
      registerPathbadgerServiceWorker({
        runtimeWindow: {
          isSecureContext: false,
          location: { hostname: "localhost" },
          navigator: {
            serviceWorker: {
              register,
            },
          },
        },
      }),
    ).resolves.toEqual({ scope: "/" });

    expect(register).toHaveBeenCalledWith("/service-worker.js", {
      scope: "/",
    });
  });

  it("fails softly when registration throws", async () => {
    const register = vi.fn().mockRejectedValue(new Error("boom"));
    const warn = vi.fn();

    await expect(
      registerPathbadgerServiceWorker({
        runtimeWindow: {
          console: { warn },
          isSecureContext: false,
          location: { hostname: "localhost" },
          navigator: {
            serviceWorker: {
              register,
            },
          },
        },
      }),
    ).resolves.toBeNull();

    expect(warn).toHaveBeenCalledOnce();
  });
});
