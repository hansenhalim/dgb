import type { CardStock, Destination, Gate, VisitSummary } from "../entities";

export type DashboardSnapshot = {
  cardStock: CardStock;
  visits: VisitSummary;
};

export interface SessionRepository {
  getDashboard(): Promise<DashboardSnapshot>;
  listGates(): Promise<Gate[]>;
  getRfidKey(uid: string): Promise<string>;
  listDestinations(): Promise<Destination[]>;
}
