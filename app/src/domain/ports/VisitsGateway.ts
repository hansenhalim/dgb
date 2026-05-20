import type { VisitHistoryEntry } from "../entities/VisitHistoryEntry";
import type { CardArea } from "../visitCard";

export type CreateVisitInput = {
  uid: string;
  photoUri: string;
  /** 16 digits (NIK or SIM left-padded with zeros). */
  identityNumber: string;
  fullname: string;
  /** Empty string when no plate. */
  vehiclePlateNumber: string;
  /** Either a fixed Keperluan label or a free-text purpose for "Lainnya". */
  purposeOfVisit: string;
  destinationName: string;
  /** The active gate at the time of entry. Server uses it to stamp the initial card state. */
  gateId: number;
};

/** Server-authoritative card state returned by create / transit / transit-enter. */
export type CardStateResponse = {
  currentArea: CardArea;
  /** Unix milliseconds; client parses from the wire ISO8601 string. */
  updatedAt: number;
};

export type CreateVisitResult = {
  visitId: string;
} & CardStateResponse;

export type GatePulseDirection = "in" | "out";

export type PulseGateInput = {
  visitId: string;
  gateId: number;
  direction: GatePulseDirection;
};

export interface VisitsGateway {
  create(input: CreateVisitInput): Promise<CreateVisitResult>;
  /** Fire-and-forget on the caller side; this method itself just dispatches the request. */
  pulseGate(input: PulseGateInput): Promise<void>;
  /** Mark a visit as ended server-side. Caller wipes the card separately. */
  checkout(visitId: string): Promise<void>;
  /** Record a transit / area-change event. Server returns the new card state to write. */
  transit(visitId: string, gateId: number): Promise<CardStateResponse>;
  /** Record a re-entry. Server returns the new card state to write. */
  transitEnter(visitId: string, gateId: number): Promise<CardStateResponse>;
  /** Recent visits for the gate. Server bounds the slice. */
  getHistory(gateId: number): Promise<VisitHistoryEntry[]>;
}
