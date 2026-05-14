import { describe, expect, it } from "vitest";

import {
  getLastUsedStartOptionDetail,
  getRememberedDefaultHelperCopy,
  getRememberedDefaultOptionDetail,
} from "./planning-start-point-state.js";

describe("getRememberedDefaultOptionDetail", () => {
  it("returns the saved coordinate when a remembered default exists", () => {
    expect(
      getRememberedDefaultOptionDetail({
        savedDefaultStart: { lat: 53.9188, lon: 9.8872 },
        storageAvailable: true,
      }),
    ).toBe("Saved in this browser at 53.9188, 9.8872.");
  });

  it("returns an unavailable message when browser local storage cannot be used", () => {
    expect(
      getRememberedDefaultOptionDetail({
        savedDefaultStart: null,
        storageAvailable: false,
      }),
    ).toBe(
      "Unavailable because browser local storage is unavailable in this browser.",
    );
  });
});

describe("getRememberedDefaultHelperCopy", () => {
  it("blocks saving the live GPS point as the remembered default", () => {
    expect(
      getRememberedDefaultHelperCopy({
        canSaveRememberedDefault: false,
        currentStart: { lat: 53.9188, lon: 9.8872 },
        savedDefaultStart: null,
        storageAvailable: true,
      }),
    ).toBe(
      "Current GPS position is intentionally not saved as the remembered default. Choose a local start first.",
    );
  });

  it("explains when no remembered default has been saved yet", () => {
    expect(
      getRememberedDefaultHelperCopy({
        canSaveRememberedDefault: true,
        currentStart: { lat: 53.9188, lon: 9.8872 },
        savedDefaultStart: null,
        storageAvailable: true,
      }),
    ).toBe(
      "No remembered default is saved in this browser yet. Save the current non-GPS start to enable that mode.",
    );
  });

  it("explains when browser local storage is unavailable", () => {
    expect(
      getRememberedDefaultHelperCopy({
        canSaveRememberedDefault: true,
        currentStart: { lat: 53.9188, lon: 9.8872 },
        savedDefaultStart: null,
        storageAvailable: false,
      }),
    ).toBe(
      "Browser local storage is unavailable, so no remembered default can be saved in this browser.",
    );
  });

  it("confirms when the current start already matches the saved default", () => {
    expect(
      getRememberedDefaultHelperCopy({
        canSaveRememberedDefault: true,
        currentStart: { lat: 53.9188, lon: 9.8872 },
        savedDefaultStart: { lat: 53.9188, lon: 9.8872 },
        storageAvailable: true,
      }),
    ).toBe("Remembered default is saved in this browser at 53.9188, 9.8872.");
  });

  it("offers to replace the saved default when the current start differs", () => {
    expect(
      getRememberedDefaultHelperCopy({
        canSaveRememberedDefault: true,
        currentStart: { lat: 53.9001, lon: 9.8001 },
        savedDefaultStart: { lat: 53.9188, lon: 9.8872 },
        storageAvailable: true,
      }),
    ).toBe(
      "Remembered default is saved at 53.9188, 9.8872. Save the current start to replace it.",
    );
  });
});

describe("getLastUsedStartOptionDetail", () => {
  it("returns the stored coordinate when a last-used start exists", () => {
    expect(
      getLastUsedStartOptionDetail({
        lastUsedStart: { lat: 53.9261, lon: 9.8967 },
        storageAvailable: true,
      }),
    ).toBe("Saved in this browser at 53.9261, 9.8967.");
  });

  it("returns an unavailable message when browser local storage is blocked", () => {
    expect(
      getLastUsedStartOptionDetail({
        lastUsedStart: null,
        storageAvailable: false,
      }),
    ).toBe(
      "Unavailable because browser local storage is unavailable in this browser.",
    );
  });

  it("explains that last-used start is disabled until a non-GPS start is used", () => {
    expect(
      getLastUsedStartOptionDetail({
        lastUsedStart: null,
        storageAvailable: true,
      }),
    ).toBe(
      "Unavailable until a non-GPS start has been used for route generation in this browser.",
    );
  });
});
