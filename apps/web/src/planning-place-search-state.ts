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
    return "Searching nearby places.";
  }

  if (!options.response) {
    return "Search for a nearby town, street, or trailhead, then use it as the start or a waypoint.";
  }

  switch (options.response.status) {
    case "success":
      return `${options.response.message} Use a match as the route start or add it as a waypoint.`;
    case "empty":
      return `${options.response.message} Try a nearby town, village, street, or trailhead inside ${options.regionName}.`;
    case "unavailable":
      return `${options.response.message} You can still place the start or waypoints directly on the map.`;
  }
}

export function getPlaceSearchRegionGuardrailCopy(regionName: string) {
  return `Search stays inside ${regionName} so generated routes remain in the supported area.`;
}

export function getPassThroughPointSourceCopy(source: "map" | "search") {
  return source === "search" ? "Local search result" : "Map click";
}
