import type { BrowserGeolocationState } from "./browser-geolocation";

export const HIGH_CONFIDENCE_GPS_MAX_AGE_MS = 15_000;
export const HIGH_CONFIDENCE_GPS_MAX_ACCURACY_METERS = 30;

export interface NavigationGpsConfidenceState {
  accuracyMeters: number | null;
  ageMs: number | null;
  hasHighConfidencePosition: boolean;
  hasLowConfidencePosition: boolean;
  isAccuracyBroad: boolean;
  isStale: boolean;
  lowConfidenceCopy: string | null;
}

export function getNavigationGpsConfidenceState(options: {
  browserGeolocation: BrowserGeolocationState;
  nowMs?: number;
}): NavigationGpsConfidenceState {
  const { position, status } = options.browserGeolocation;

  if (status !== "ready" || !position) {
    return {
      accuracyMeters: position?.accuracyMeters ?? null,
      ageMs: null,
      hasHighConfidencePosition: false,
      hasLowConfidencePosition: false,
      isAccuracyBroad: false,
      isStale: false,
      lowConfidenceCopy: null,
    };
  }

  const accuracyMeters = position.accuracyMeters;
  const nowMs = options.nowMs ?? Date.now();
  const ageMs = Math.max(nowMs - position.timestampMs, 0);
  const isAccuracyBroad =
    accuracyMeters === null ||
    accuracyMeters > HIGH_CONFIDENCE_GPS_MAX_ACCURACY_METERS;
  const isStale = ageMs > HIGH_CONFIDENCE_GPS_MAX_AGE_MS;
  const hasLowConfidencePosition = isAccuracyBroad || isStale;

  return {
    accuracyMeters,
    ageMs,
    hasHighConfidencePosition: !hasLowConfidencePosition,
    hasLowConfidencePosition,
    isAccuracyBroad,
    isStale,
    lowConfidenceCopy: hasLowConfidencePosition
      ? buildLowConfidenceCopy({
          accuracyMeters,
          ageMs,
          isAccuracyBroad,
          isStale,
        })
      : null,
  };
}

export function getNavigationGpsGuardrailPreviewCopy() {
  return "Low-confidence or stale live GPS fixes stay conservative: Pathbadger keeps progress and route-deviation cues approximate until the browser reports a tighter update.";
}

function buildLowConfidenceCopy(options: {
  accuracyMeters: number | null;
  ageMs: number;
  isAccuracyBroad: boolean;
  isStale: boolean;
}) {
  const reasons = [];

  if (options.isAccuracyBroad) {
    reasons.push(
      options.accuracyMeters === null
        ? "the browser did not report an accuracy radius"
        : `reported accuracy is ${formatAccuracyMeters(options.accuracyMeters)}`,
    );
  }

  if (options.isStale) {
    reasons.push(`the latest update is ${formatAgeMs(options.ageMs)} old`);
  }

  return `This live browser GPS fix is being treated conservatively because ${joinReasons(reasons)}. Progress and off-route cues stay approximate until a tighter update arrives.`;
}

function formatAccuracyMeters(accuracyMeters: number) {
  return `+/-${Math.round(accuracyMeters)} m`;
}

function formatAgeMs(ageMs: number) {
  const ageSeconds = Math.max(Math.round(ageMs / 1_000), 1);

  return `${ageSeconds} s`;
}

function joinReasons(reasons: string[]) {
  if (reasons.length <= 1) {
    return reasons[0] ?? "confidence is reduced";
  }

  return `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;
}
