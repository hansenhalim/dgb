import type { Destination, Gate } from "@/domain/entities";
import type { DashboardSnapshot, SessionRepository } from "@/domain/ports";

import { delay } from "./latency";

const RFID_KEY = "C0FFEE".repeat(32);

const gates: Gate[] = [
  { id: 1, name: "Gerbang 1", isAvailable: true },
  { id: 2, name: "Gerbang 2", isAvailable: true },
  { id: 3, name: "Gerbang 3", isAvailable: true },
  { id: 4, name: "Gerbang 4", isAvailable: true },
];

const dashboardByGate: Record<number, DashboardSnapshot> = {
  1: {
    cardStock: { available: 55, total: 60 },
    visits: { total: 14, active: 5 },
    hasIncomingTransferRequest: false,
  },
  2: {
    cardStock: { available: 45, total: 48 },
    visits: { total: 9, active: 3 },
    hasIncomingTransferRequest: true,
  },
  3: {
    cardStock: { available: 55, total: 59 },
    visits: { total: 5, active: 4 },
    hasIncomingTransferRequest: false,
  },
  4: {
    cardStock: { available: 0, total: 0 },
    visits: { total: 0, active: 0 },
    hasIncomingTransferRequest: false,
  },
};

const destinations: Destination[] = [
  { name: "AA-1", position: "VIL_1" },
  { name: "AA-2", position: "VIL_2" },
  { name: "AA-3", position: "VIL_E" },
  { name: "AB-1", position: "VIL_1" },
  { name: "AB-2", position: "VIL_2" },
  { name: "BA-1", position: "VIL_1" },
  { name: "BA-2", position: "VIL_2" },
  { name: "CA-1", position: "VIL_E" },
  { name: "CB-1", position: "VIL_1" },
  { name: "CB-2", position: "VIL_2" },
];

export class MockSessionRepository implements SessionRepository {
  async getDashboard(gateId: number): Promise<DashboardSnapshot> {
    await delay(120);
    return (
      dashboardByGate[gateId] ?? {
        cardStock: { available: 0, total: 0 },
        visits: { total: 0, active: 0 },
        hasIncomingTransferRequest: false,
      }
    );
  }

  async listGates(): Promise<Gate[]> {
    await delay(60);
    return [...gates];
  }

  async getRfidKey(_uid: string): Promise<string> {
    await delay(150);
    return RFID_KEY;
  }

  async listDestinations(): Promise<Destination[]> {
    await delay(120);
    return [...destinations];
  }
}
