import type { RouteInstruction } from "@pathbadger/shared";

export function getCompactNavigationInstructionTitle(
  instruction: RouteInstruction,
) {
  const streetName = normalizeStreetName(instruction.streetName);

  switch (instruction.type) {
    case "turn_left":
      return streetName ? `Turn left onto ${streetName}` : "Turn left";
    case "turn_right":
      return streetName ? `Turn right onto ${streetName}` : "Turn right";
    case "turn_sharp_left":
      return streetName ? `Sharp left onto ${streetName}` : "Sharp left";
    case "turn_sharp_right":
      return streetName ? `Sharp right onto ${streetName}` : "Sharp right";
    case "turn_slight_left":
      return streetName ? `Slight left onto ${streetName}` : "Slight left";
    case "turn_slight_right":
      return streetName ? `Slight right onto ${streetName}` : "Slight right";
    case "continue":
      return streetName ? `Continue on ${streetName}` : "Continue";
    case "depart":
      return streetName ? `Start on ${streetName}` : "Start";
    case "u_turn_left":
    case "u_turn_right":
      return "Make a U-turn";
    case "arrive":
      return "Arrive";
    case "via":
      return streetName ? `Pass ${streetName}` : "Continue";
    default:
      return trimInstructionText(instruction.text);
  }
}

export function getCompactNavigationGpsStatusLabel(options: {
  accuracyMeters: number | null;
  ageMs: number | null;
  isAccuracyBroad: boolean;
  isStale: boolean;
}) {
  if (options.isAccuracyBroad && options.accuracyMeters !== null) {
    return `GPS ${formatWholeMeters(options.accuracyMeters)}`;
  }

  if (options.isStale && options.ageMs !== null) {
    return `GPS ${Math.max(Math.round(options.ageMs / 1_000), 1)} s old`;
  }

  return "Approx GPS";
}

function normalizeStreetName(streetName: string | null) {
  const normalizedStreetName = streetName?.trim() ?? null;
  return normalizedStreetName && normalizedStreetName.length > 0
    ? normalizedStreetName
    : null;
}

function trimInstructionText(text: string) {
  const withoutTowardTail =
    text.split(/\s+and\s+(?:drive|continue|head|go|keep)\s+toward\s+/i)[0] ??
    text;
  const withoutTowardClause =
    withoutTowardTail.split(/\s+toward\s+/i)[0] ?? withoutTowardTail;

  return withoutTowardClause.replace(/\s+/g, " ").trim();
}

function formatWholeMeters(distanceMeters: number) {
  return `${Math.round(distanceMeters)} m`;
}
