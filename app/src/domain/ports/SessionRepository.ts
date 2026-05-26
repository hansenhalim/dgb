import type { CardStock, Destination, Gate, VisitSummary } from "../entities";

export type DashboardSnapshot = {
  cardStock: CardStock;
  visits: VisitSummary;
  hasIncomingTransferRequest: boolean;
};

export interface SessionRepository {
  getDashboard(gateId: number): Promise<DashboardSnapshot>;
  listGates(): Promise<Gate[]>;
  getRfidKey(uid: string): Promise<string>;
  listDestinations(): Promise<Destination[]>;
}
