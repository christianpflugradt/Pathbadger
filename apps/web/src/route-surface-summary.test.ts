import { describe, expect, it } from "vitest";

import {
  getRouteSurfaceSummaryCards,
  getRouteSurfaceSummaryMessage,
} from "./route-surface-summary.js";

describe("route surface summary helpers", () => {
  it("formats the routed surface breakdown into readable cards", () => {
    expect(
      getRouteSurfaceSummaryCards({
        totalDistanceKm: 12.34,
        targetDistanceKm: 12,
        distanceDeltaMeters: 340,
        elevationGainMeters: 88,
        surface: {
          asphaltPercent: 25,
          trailUnpavedPercent: 40,
          fieldTrackOtherPercent: 10,
          unknownPercent: 25,
        },
      }),
    ).toEqual([
      {
        id: "asphalt",
        label: "Asphalt / paved",
        valueText: "25%",
        meterPercent: 25,
      },
      {
        id: "trail-unpaved",
        label: "Trail / unpaved",
        valueText: "40%",
        meterPercent: 40,
      },
      {
        id: "field-track-other",
        label: "Track / path / other",
        valueText: "10%",
        meterPercent: 10,
      },
      {
        id: "unknown",
        label: "Unknown coverage",
        valueText: "25%",
        meterPercent: 25,
      },
    ]);
  });

  it("warns when the routed surface breakdown includes unknown coverage", () => {
    expect(
      getRouteSurfaceSummaryMessage({
        totalDistanceKm: 12.34,
        targetDistanceKm: 12,
        distanceDeltaMeters: 340,
        elevationGainMeters: 88,
        surface: {
          asphaltPercent: 25,
          trailUnpavedPercent: 40,
          fieldTrackOtherPercent: 0,
          unknownPercent: 35,
        },
      }),
    ).toBe(
      "35% of this route could not be classified, so the surface breakdown is partial.",
    );
  });

  it("stays honest when no routed surface breakdown is available", () => {
    expect(getRouteSurfaceSummaryMessage(null)).toBe(
      "Surface composition is unavailable because this preview did not return a route summary.",
    );
    expect(
      getRouteSurfaceSummaryMessage({
        totalDistanceKm: 12.34,
        targetDistanceKm: 12,
        distanceDeltaMeters: 340,
        elevationGainMeters: 88,
        surface: {
          asphaltPercent: null,
          trailUnpavedPercent: null,
          fieldTrackOtherPercent: null,
          unknownPercent: null,
        },
      }),
    ).toBe("Surface composition is not available for this routed preview yet.");
  });
});
