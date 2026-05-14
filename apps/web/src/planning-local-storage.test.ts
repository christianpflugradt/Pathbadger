import { describe, expect, it } from "vitest";

import {
  getBrowserLocalStorage,
  loadStoredCoordinate,
  saveStoredCoordinate,
} from "./planning-local-storage.js";

describe("getBrowserLocalStorage", () => {
  it("returns null when the browser window is unavailable", () => {
    expect(getBrowserLocalStorage()).toBeNull();
  });
});

describe("loadStoredCoordinate", () => {
  it("returns null when no storage is available", () => {
    expect(
      loadStoredCoordinate({
        key: "pathbadger.savedDefaultStart",
        storage: null,
      }),
    ).toBeNull();
  });

  it("returns null when the storage value is missing", () => {
    expect(
      loadStoredCoordinate({
        key: "pathbadger.savedDefaultStart",
        storage: createStorage(),
      }),
    ).toBeNull();
  });

  it("returns null when the storage value is invalid JSON", () => {
    expect(
      loadStoredCoordinate({
        key: "pathbadger.savedDefaultStart",
        storage: createStorage({
          "pathbadger.savedDefaultStart": "{not-json",
        }),
      }),
    ).toBeNull();
  });

  it("returns null when the storage value is not a coordinate", () => {
    expect(
      loadStoredCoordinate({
        key: "pathbadger.savedDefaultStart",
        storage: createStorage({
          "pathbadger.savedDefaultStart": JSON.stringify({
            lat: "53.9188",
            lon: 9.8872,
          }),
        }),
      }),
    ).toBeNull();
  });

  it("loads a stored coordinate when the JSON shape is valid", () => {
    expect(
      loadStoredCoordinate({
        key: "pathbadger.savedDefaultStart",
        storage: createStorage({
          "pathbadger.savedDefaultStart": JSON.stringify({
            lat: 53.9188,
            lon: 9.8872,
          }),
        }),
      }),
    ).toEqual({
      lat: 53.9188,
      lon: 9.8872,
    });
  });
});

describe("saveStoredCoordinate", () => {
  it("returns false when no storage is available", () => {
    expect(
      saveStoredCoordinate({
        coordinate: { lat: 53.9188, lon: 9.8872 },
        key: "pathbadger.savedDefaultStart",
        storage: null,
      }),
    ).toBe(false);
  });

  it("returns false when writing to storage throws", () => {
    expect(
      saveStoredCoordinate({
        coordinate: { lat: 53.9188, lon: 9.8872 },
        key: "pathbadger.savedDefaultStart",
        storage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("quota exceeded");
          },
        },
      }),
    ).toBe(false);
  });

  it("writes a serialized coordinate when storage is available", () => {
    const storage = createStorage();

    expect(
      saveStoredCoordinate({
        coordinate: { lat: 53.9188, lon: 9.8872 },
        key: "pathbadger.savedDefaultStart",
        storage,
      }),
    ).toBe(true);
    expect(storage.getItem("pathbadger.savedDefaultStart")).toBe(
      JSON.stringify({
        lat: 53.9188,
        lon: 9.8872,
      }),
    );
  });
});

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}
