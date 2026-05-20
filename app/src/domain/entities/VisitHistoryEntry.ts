import type { VisitPosition } from "../visitCard";

export type VisitHistoryEntry = {
  id: string;
  vehiclePlateNumber: string;
  /** Wire enum code (e.g. "VIL_1", "TRNST", "OUT"). Use POSITION_LABEL for UI text. */
  currentPosition: VisitPosition;
  destinationName: string;
  /** Unix milliseconds; client parses from the wire ISO8601 string. */
  createdAt: number;
};
