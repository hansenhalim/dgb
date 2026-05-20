import { loadSession } from "@/data/auth/sessionStore";
import type { Destination, Gate } from "@/domain/entities";
import type {
  DashboardSnapshot,
  SessionRepository,
} from "@/domain/ports";
import { ENUM_BY_AREA, type CardArea } from "@/domain/visitCard";

import { request, type ApiEnvelope } from "./httpClient";

type RfidKeyResponse = { message: string; rfid_key: string };

type ApiGate = {
  id: number;
  name: string;
  current_quota: number;
  is_available: boolean;
};

type ApiDestination = {
  name: string;
  position: string;
};

function toGate(g: ApiGate): Gate {
  return {
    id: g.id,
    name: g.name,
    currentQuota: g.current_quota,
    isAvailable: g.is_available,
  };
}

export class ApiSessionRepository implements SessionRepository {
  getDashboard(): Promise<DashboardSnapshot> {
    return request<DashboardSnapshot>("/session/dashboard");
  }

  async listGates(): Promise<Gate[]> {
    const res = await request<ApiEnvelope<ApiGate[]>>("/gates");
    return res.data.map(toGate);
  }

  async getRfidKey(uid: string): Promise<string> {
    const session = await loadSession();
    const res = await request<RfidKeyResponse>(
      `/api/rfid-key?uid=${encodeURIComponent(uid)}`,
      { token: session?.token ?? null },
    );
    return res.rfid_key;
  }

  async listDestinations(): Promise<Destination[]> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<ApiDestination[]>>(
      "/api/destinations",
      { token: session?.token ?? null },
    );
    return res.data.map((d) => {
      if (!(d.position in ENUM_BY_AREA)) {
        throw new Error(`Server returned unknown destination position: ${d.position}`);
      }
      return { name: d.name, position: d.position as CardArea };
    });
  }
}
