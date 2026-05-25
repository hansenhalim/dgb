export type VisitorLatestVisit = {
  id: string;
  vehiclePlateNumber: string;
  purposeOfVisit: string;
  destinationName: string;
  /** Unix milliseconds; parsed from the wire ISO8601 string. */
  createdAt: number;
};

export type VisitorPreflight = {
  id: string;
  fullname: string;
  /** Unix milliseconds when banned; null when not banned. */
  bannedAt: number | null;
  bannedReason: string | null;
  latestVisit: VisitorLatestVisit | null;
};

export interface VisitorsGateway {
  /**
   * Look up a visitor by their padded 16-digit identity number.
   * Returns null when the server responds 204 (no such visitor).
   */
  lookup(
    identityNumber: string,
    signal?: AbortSignal,
  ): Promise<VisitorPreflight | null>;
}
