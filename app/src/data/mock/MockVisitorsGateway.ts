import type {
  VisitorPreflight,
  VisitorsGateway,
} from "@/domain/ports";

import { delay } from "./latency";

function fakeUuid(seed: string): string {
  // Deterministic 36-char UUID-shaped string from the seed.
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = (n: number) => (hash + n).toString(16).padStart(8, "0").slice(-8);
  return `${hex(0)}-${hex(1).slice(0, 4)}-${hex(2).slice(0, 4)}-${hex(3).slice(0, 4)}-${hex(4)}${hex(5).slice(0, 4)}`;
}

export class MockVisitorsGateway implements VisitorsGateway {
  async lookup(
    identityNumber: string,
    _signal?: AbortSignal,
  ): Promise<VisitorPreflight | null> {
    await delay(220);
    // Hash-based deterministic fixtures: tail digits select the branch.
    if (identityNumber.endsWith("0000")) {
      return {
        id: fakeUuid(identityNumber),
        fullname: "BUDI SANTOSO",
        bannedAt: Date.now() - 14 * 24 * 60 * 60_000,
        bannedReason: "Pelanggaran aturan tamu",
        latestVisit: null,
      };
    }
    if (identityNumber.endsWith("1111")) {
      return {
        id: fakeUuid(identityNumber),
        fullname: "SITI RAHAYU",
        bannedAt: null,
        bannedReason: null,
        latestVisit: {
          id: fakeUuid(identityNumber + "-v"),
          vehiclePlateNumber: "BE 1199 AA",
          purposeOfVisit: "Service AC Rumah",
          destinationName: "AA-1",
          createdAt: Date.now() - 3 * 24 * 60 * 60_000,
        },
      };
    }
    return null;
  }
}
