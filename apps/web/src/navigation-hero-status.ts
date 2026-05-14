export interface NavigationHeroStatusOptions {
  canStartNavigation: boolean;
  isNavigationActive: boolean;
  isRoutePreviewStale: boolean;
}

export interface NavigationHeroStatusState {
  label: string;
  statusPillClassName: string;
}

export function getNavigationHeroStatus(
  options: NavigationHeroStatusOptions,
): NavigationHeroStatusState {
  if (options.isNavigationActive) {
    return {
      label: "Navigation session live",
      statusPillClassName: "status-pill--active",
    };
  }

  if (options.canStartNavigation) {
    return {
      label: "Navigation ready",
      statusPillClassName: "status-pill--active",
    };
  }

  if (options.isRoutePreviewStale) {
    return {
      label: "Navigation needs fresh preview",
      statusPillClassName: "status-pill--warning",
    };
  }

  return {
    label: "Navigation waits for preview",
    statusPillClassName: "status-pill--warning",
  };
}
