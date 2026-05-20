import type { Destination, Gate } from "@/domain/entities";
import type { DashboardSnapshot, SessionRepository } from "@/domain/ports";

import { delay } from "./latency";

const RFID_KEY = "C0FFEE".repeat(32);

const gates: Gate[] = [
  { id: 1, name: "Gerbang 1", currentQuota: 55, isAvailable: true },
  { id: 2, name: "Gerbang 2", currentQuota: 45, isAvailable: true },
  { id: 3, name: "Gerbang 3", currentQuota: 55, isAvailable: true },
  { id: 4, name: "Gerbang 4", currentQuota: 0, isAvailable: true },
];

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
  async getDashboard(): Promise<DashboardSnapshot> {
    await delay(120);
    return {
      cardStock: { available: 50, total: 55 },
      visits: { total: 28, active: 12 },
    };
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
