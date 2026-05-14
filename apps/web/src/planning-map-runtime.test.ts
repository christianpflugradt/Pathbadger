import { describe, expect, it } from "vitest";

import {
  getMapErrorMessage,
  getNextPlanningMapLoadStateOnError,
} from "./planning-map-runtime";

describe("getNextPlanningMapLoadStateOnError", () => {
  it("moves a loading map into the error state", () => {
    expect(getNextPlanningMapLoadStateOnError("loading")).toBe("error");
  });

  it("moves a ready map back out of the ready state after a runtime error", () => {
    expect(getNextPlanningMapLoadStateOnError("ready")).toBe("error");
  });

  it("keeps an errored map in the error state", () => {
    expect(getNextPlanningMapLoadStateOnError("error")).toBe("error");
  });
});

describe("getMapErrorMessage", () => {
  it("prefers an explicit Error message", () => {
    expect(
      getMapErrorMessage(
        new Error("Tile source payload was invalid."),
        "/styles/basic/style.json",
      ),
    ).toBe("Tile source payload was invalid.");
  });

  it("falls back to the configured style url when the error is opaque", () => {
    expect(getMapErrorMessage(null, "/styles/basic/style.json")).toContain(
      "/styles/basic/style.json",
    );
  });
});
