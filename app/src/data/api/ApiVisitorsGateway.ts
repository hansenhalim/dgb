import { loadSession } from "@/data/auth/sessionStore";
import type {
  VisitorLatestVisit,
  VisitorPreflight,
  VisitorsGateway,
} from "@/domain/ports";

import { request, type ApiEnvelope } from "./httpClient";

type LatestVisitWire = {
  id: string;
  vehicle_plate_number: string;
  purpose_of_visit: string;
  destination_name: string;
  created_at: string;
};

type VisitorWire = {
  id: string;
  fullname: string;
  banned_at: string | null;
  banned_reason: string | null;
  latest_visit: LatestVisitWire | null;
};

function parseTimestamp(value: string, field: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`Server returned invalid ${field}: ${value}`);
  }
  return ms;
}

function parseLatestVisit(wire: LatestVisitWire): VisitorLatestVisit {
  return {
    id: wire.id,
    vehiclePlateNumber: wire.vehicle_plate_number,
    purposeOfVisit: wire.purpose_of_visit,
    destinationName: wire.destination_name,
    createdAt: parseTimestamp(wire.created_at, "created_at"),
  };
}

function parseVisitor(wire: VisitorWire): VisitorPreflight {
  return {
    id: wire.id,
    fullname: wire.fullname,
    bannedAt: wire.banned_at ? parseTimestamp(wire.banned_at, "banned_at") : null,
    bannedReason: wire.banned_reason,
    latestVisit: wire.latest_visit ? parseLatestVisit(wire.latest_visit) : null,
  };
}

export class ApiVisitorsGateway implements VisitorsGateway {
  async lookup(
    identityNumber: string,
    signal?: AbortSignal,
  ): Promise<VisitorPreflight | null> {
    const session = await loadSession();
    const query = new URLSearchParams({ identity_number: identityNumber });
    const res = await request<ApiEnvelope<VisitorWire> | null>(
      `/v2/visitors?${query.toString()}`,
      { token: session?.token ?? null, signal },
    );
    return res ? parseVisitor(res.data) : null;
  }
}
