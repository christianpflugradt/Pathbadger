import type {
  Coordinate,
  PlaceSearchResponse,
  PlaceSearchResult,
} from "@pathbadger/shared";

export interface PlannerMapStartSelection {
  coordinate: Coordinate;
  label: string | null;
  source: "map" | "search";
}

export interface PlannerPassThroughPoint {
  coordinate: Coordinate;
  id: string;
  label: string;
  source: "map" | "search";
}

export interface PlaceSearchFeedbackOptions {
  errorMessage: string | null;
  isLoading: boolean;
  regionName: string;
  response: PlaceSearchResponse | null;
}

export function createMapStartSelection(
  coordinate: Coordinate,
): PlannerMapStartSelection {
  return {
    coordinate,
    label: null,
    source: "map",
  };
}

export function createSearchStartSelection(
  result: PlaceSearchResult,
): PlannerMapStartSelection {
  return {
    coordinate: result.coordinate,
    label: result.label,
    source: "search",
  };
}

export function createMapPassThroughPoint(options: {
  coordinate: Coordinate;
  id: string;
  index: number;
}): PlannerPassThroughPoint {
  return {
    coordinate: options.coordinate,
    id: options.id,
    label: `Map waypoint ${options.index}`,
    source: "map",
  };
}

export function createSearchPassThroughPoint(options: {
  id: string;
  result: PlaceSearchResult;
}): PlannerPassThroughPoint {
  return {
    coordinate: options.result.coordinate,
    id: options.id,
    label: options.result.label,
    source: "search",
  };
}

export function getPlaceSearchFeedbackClassName(
  options: PlaceSearchFeedbackOptions,
) {
  if (options.errorMessage) {
    return "helper-copy--error";
  }

  if (options.isLoading) {
    return "helper-copy--active";
  }

  if (!options.response) {
    return "";
  }

  switch (options.response.status) {
    case "success":
      return "helper-copy--active";
    case "empty":
      return "helper-copy--warning";
    case "unavailable":
      return "helper-copy--warning";
  }
}

export function getPlaceSearchFeedbackCopy(
  options: PlaceSearchFeedbackOptions,
) {
  if (options.errorMessage) {
    return options.errorMessage;
  }

  if (options.isLoading) {
    return "Searching the supported same-origin local place boundary.";
  }

  if (!options.response) {
    return "Search the supported same-origin local place boundary, then apply a result as the route start or another pass-through point.";
  }

  switch (options.response.status) {
    case "success":
      return `${options.response.message} Apply a match as the route start or add it to the pass-through list.`;
    case "empty":
      return `${options.response.message} Try a nearby town, village, street, or trailhead inside ${options.regionName}.`;
    case "unavailable":
      return `${options.response.message} The planner keeps manual map clicks available instead of silently inventing a fallback search result.`;
  }
}

export function getPlaceSearchRegionGuardrailCopy(regionName: string) {
  return `Routing still only supports places that can be previewed inside ${regionName}. If a broader provider returns an out-of-region match, preview generation will reject it honestly instead of silently snapping it back into range.`;
}

export function getPassThroughPointSourceCopy(source: "map" | "search") {
  return source === "search" ? "Local search result" : "Map click";
}
