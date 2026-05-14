export type MapLoadState = "loading" | "ready" | "error";

export function getNextPlanningMapLoadStateOnError(
  currentState: MapLoadState,
): MapLoadState {
  return currentState === "error" ? currentState : "error";
}

export function getMapErrorMessage(error: unknown, styleUrl: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return `Could not load the self-hosted style at ${styleUrl}. Check that the tile stack is running and the style URL is reachable.`;
}
