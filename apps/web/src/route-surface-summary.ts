import type { RouteSummary } from "@pathbadger/shared";

export interface RouteSurfaceSummaryCard {
  id: string;
  label: string;
  valueText: string;
  meterPercent: number | null;
}

export function getRouteSurfaceSummaryCards(summary: RouteSummary | null) {
  const surface = summary?.surface;

  return [
    createRouteSurfaceSummaryCard(
      "asphalt",
      "Asphalt / paved",
      surface?.asphaltPercent ?? null,
    ),
    createRouteSurfaceSummaryCard(
      "trail-unpaved",
      "Trail / unpaved",
      surface?.trailUnpavedPercent ?? null,
    ),
    createRouteSurfaceSummaryCard(
      "field-track-other",
      "Track / path / other",
      surface?.fieldTrackOtherPercent ?? null,
    ),
    createRouteSurfaceSummaryCard(
      "unknown",
      "Unknown coverage",
      surface?.unknownPercent ?? null,
    ),
  ];
}

export function getRouteSurfaceSummaryMessage(summary: RouteSummary | null) {
  if (!summary) {
    return "Surface composition is unavailable because this preview did not return a route summary.";
  }

  const surfaceCards = getRouteSurfaceSummaryCards(summary);
  const hasKnownSurfaceValues = surfaceCards.some(
    (card) => card.meterPercent !== null,
  );

  if (!hasKnownSurfaceValues) {
    return "Surface composition is not available for this routed preview yet.";
  }

  const unknownPercent = summary.surface.unknownPercent ?? null;

  if (unknownPercent !== null && unknownPercent > 0) {
    return `${formatRouteSurfacePercent(unknownPercent)} of this route could not be classified, so the surface breakdown is partial.`;
  }

  return "Surface classification is available across the full routed preview.";
}

function createRouteSurfaceSummaryCard(
  id: string,
  label: string,
  value: number | null,
): RouteSurfaceSummaryCard {
  return {
    id,
    label,
    valueText: formatRouteSurfacePercent(value),
    meterPercent: value,
  };
}

function formatRouteSurfacePercent(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return `${Number(value.toFixed(1))}%`;
}
