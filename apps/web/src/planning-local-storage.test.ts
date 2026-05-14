import { describe, expect, it } from "vitest";

import {
  getBrowserLocalStorage,
  loadStoredCoordinate,
  loadStoredStringValue,
  saveStoredCoordinate,
  saveStoredStringValue,
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

describe("loadStoredStringValue", () => {
  const allowedValues = ["running_walking", "cycling"] as const;

  it("returns null when no storage is available", () => {
    expect(
      loadStoredStringValue({
        allowedValues,
        key: "pathbadger.activityPreference",
        storage: null,
      }),
    ).toBeNull();
  });

  it("returns null when the storage value is missing", () => {
    expect(
      loadStoredStringValue({
        allowedValues,
        key: "pathbadger.activityPreference",
        storage: createStorage(),
      }),
    ).toBeNull();
  });

  it("returns null when the storage value is not allowed", () => {
    expect(
      loadStoredStringValue({
        allowedValues,
        key: "pathbadger.activityPreference",
        storage: createStorage({
          "pathbadger.activityPreference": "driving",
        }),
      }),
    ).toBeNull();
  });

  it("loads a stored string when it matches an allowed value", () => {
    expect(
      loadStoredStringValue({
        allowedValues,
        key: "pathbadger.activityPreference",
        storage: createStorage({
          "pathbadger.activityPreference": "cycling",
        }),
      }),
    ).toBe("cycling");
  });
});

describe("saveStoredStringValue", () => {
  it("returns false when no storage is available", () => {
    expect(
      saveStoredStringValue({
        key: "pathbadger.activityPreference",
        storage: null,
        value: "cycling",
      }),
    ).toBe(false);
  });

  it("returns false when writing to storage throws", () => {
    expect(
      saveStoredStringValue({
        key: "pathbadger.activityPreference",
        storage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("quota exceeded");
          },
        },
        value: "cycling",
      }),
    ).toBe(false);
  });

  it("writes a raw string when storage is available", () => {
    const storage = createStorage();

    expect(
      saveStoredStringValue({
        key: "pathbadger.activityPreference",
        storage,
        value: "cycling",
      }),
    ).toBe(true);
    expect(storage.getItem("pathbadger.activityPreference")).toBe("cycling");
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
