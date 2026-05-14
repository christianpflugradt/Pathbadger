export type NavigationEtaSource = "average_speed" | "current_speed" | null;

export type NavigationEtaState = {
  estimateLabel: string;
  helperCopy: string;
  isAvailable: boolean;
  source: NavigationEtaSource;
};

export const MIN_NAVIGATION_ETA_SPEED_KMH = 1;

export function getNavigationEtaState(options: {
  averageSpeedKmh: number | null;
  currentSpeedKmh: number | null;
  hasFreshPosition: boolean;
  hasLowConfidencePosition: boolean;
  hasTrackedPosition: boolean;
  remainingDistanceMeters: number | null;
}): NavigationEtaState {
  if (!options.hasTrackedPosition || options.remainingDistanceMeters === null) {
    return {
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time will appear once browser geolocation produces route progress and a defensible speed estimate.",
      isAvailable: false,
      source: null,
    };
  }

  if (options.remainingDistanceMeters <= 0) {
    return {
      estimateLabel: "<1 min",
      helperCopy:
        "Route progress is effectively complete, so Pathbadger is treating the remaining time as immediate.",
      isAvailable: true,
      source: null,
    };
  }

  if (options.hasLowConfidencePosition) {
    return {
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time stays unavailable while the latest live GPS fix is low-confidence or stale.",
      isAvailable: false,
      source: null,
    };
  }

  if (!options.hasFreshPosition) {
    return {
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time waits for a fresh browser GPS fix before treating speed and remaining distance as trustworthy live evidence.",
      isAvailable: false,
      source: null,
    };
  }

  const source = getNavigationEtaSource(options);

  if (source === null) {
    return {
      estimateLabel: "Unavailable",
      helperCopy:
        "Estimated remaining time waits for either a steady live speed sample or enough timestamped route progress to support an honest average pace.",
      isAvailable: false,
      source: null,
    };
  }

  const speedKmh =
    source === "average_speed"
      ? options.averageSpeedKmh
      : options.currentSpeedKmh;

  const estimatedHours =
    (options.remainingDistanceMeters ?? 0) / 1_000 / (speedKmh ?? 1);

  return {
    estimateLabel: formatNavigationEtaHours(estimatedHours),
    helperCopy:
      source === "average_speed"
        ? "Estimated remaining time is using timestamped average route progress, so it will smooth over short pace swings."
        : "Estimated remaining time is using the latest fresh browser speed sample and may swing as your pace changes.",
    isAvailable: true,
    source,
  };
}

export function formatNavigationEtaHours(estimatedHours: number) {
  if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
    return "<1 min";
  }

  if (estimatedHours * 60 < 1) {
    return "<1 min";
  }

  const totalMinutes = Math.max(Math.round(estimatedHours * 60), 0);

  if (totalMinutes < 1) {
    return "<1 min";
  }

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} hr ${minutes.toString().padStart(2, "0")} min`;
}

function getNavigationEtaSource(options: {
  averageSpeedKmh: number | null;
  currentSpeedKmh: number | null;
}) {
  if (isUsableSpeedKmh(options.averageSpeedKmh)) {
    return "average_speed";
  }

  if (isUsableSpeedKmh(options.currentSpeedKmh)) {
    return "current_speed";
  }

  return null;
}

function isUsableSpeedKmh(speedKmh: number | null) {
  return (
    typeof speedKmh === "number" &&
    Number.isFinite(speedKmh) &&
    speedKmh >= MIN_NAVIGATION_ETA_SPEED_KMH
  );
}
