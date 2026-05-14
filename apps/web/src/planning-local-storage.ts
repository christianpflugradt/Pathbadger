import type { Coordinate } from "@pathbadger/shared";

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function getBrowserLocalStorage(): BrowserStorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredCoordinate(options: {
  key: string;
  storage: BrowserStorageLike | null;
}) {
  if (!options.storage) {
    return null;
  }

  try {
    const rawValue = options.storage.getItem(options.key);

    if (rawValue === null) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    return isCoordinate(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function loadStoredStringValue<T extends string>(options: {
  allowedValues: readonly T[];
  key: string;
  storage: BrowserStorageLike | null;
}) {
  if (!options.storage) {
    return null;
  }

  try {
    const rawValue = options.storage.getItem(options.key);

    if (rawValue === null) {
      return null;
    }

    return options.allowedValues.includes(rawValue as T)
      ? (rawValue as T)
      : null;
  } catch {
    return null;
  }
}

export function saveStoredCoordinate(options: {
  coordinate: Coordinate;
  key: string;
  storage: BrowserStorageLike | null;
}) {
  if (!options.storage) {
    return false;
  }

  try {
    options.storage.setItem(options.key, JSON.stringify(options.coordinate));
    return true;
  } catch {
    return false;
  }
}

export function saveStoredStringValue(options: {
  key: string;
  storage: BrowserStorageLike | null;
  value: string;
}) {
  if (!options.storage) {
    return false;
  }

  try {
    options.storage.setItem(options.key, options.value);
    return true;
  } catch {
    return false;
  }
}

function isCoordinate(value: unknown): value is Coordinate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Coordinate>;

  return (
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat) &&
    typeof candidate.lon === "number" &&
    Number.isFinite(candidate.lon)
  );
}
