import type { CardArea } from "./visitCard";

export type GateDirection = "in" | "transit" | "out";

/**
 * Outcome of a (gate, direction) pulse on the card's `current_area`:
 *   CardArea  → write that area to the card
 *   "wipe"    → checkout (blank the card)
 *   undefined → not supported at this gate (UI must not offer the button)
 */
export type GateAreaResult = CardArea | "wipe" | undefined;

/**
 * Source of truth for what each (gate, direction) does to the card state.
 * The server has its own copy and is authoritative for the resulting card state;
 * this client-side copy drives UI button visibility only.
 */
const GATE_AREA_MAP: Readonly<
  Record<number, Readonly<Partial<Record<GateDirection, CardArea | "wipe">>>>
> = {
  1: { in: "VIL_1", out: "wipe" },
  2: { in: "VIL_1", transit: "TRNST", out: "wipe" },
  3: { in: "VIL_2", transit: "TRNST", out: "wipe" },
  4: { in: "VIL_E", out: "VIL_2" },
};

const DIRECTION_ORDER: readonly GateDirection[] = ["in", "transit", "out"];

export function gateSupportedDirections(gateId: number): GateDirection[] {
  const entry = GATE_AREA_MAP[gateId];
  if (!entry) return [];
  return DIRECTION_ORDER.filter((d) => entry[d] !== undefined);
}

export function gateAreaResult(
  gateId: number,
  direction: GateDirection,
): GateAreaResult {
  return GATE_AREA_MAP[gateId]?.[direction];
}

/**
 * Areas reachable on foot from each gate (including paths through internal boundaries).
 * Used only by the preview screen's destination-mismatch warning — not by the state
 * machine. Gate 3 → villa2 is the literal `in` area, but exclusive is also reachable
 * via gate 4, so gate 3 is "fine" for exclusive-bound visitors and the warning stays
 * silent. Mirrors the prior `gatePositions` UX logic.
 */
const GATE_REACHABLE_AREAS: Readonly<Record<number, readonly CardArea[]>> = {
  1: ["VIL_1"],
  2: ["VIL_1"],
  3: ["VIL_2", "VIL_E"],
  4: ["VIL_E"],
};

export function gateAllowsArea(gateId: number, area: CardArea): boolean {
  const allowed = GATE_REACHABLE_AREAS[gateId];
  if (!allowed) return true;
  return allowed.includes(area);
}
