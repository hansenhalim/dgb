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

type ApiHome = {
  cardStock: { available: number; total: number };
  visits: { active: number; total: number };
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
  async getDashboard(): Promise<DashboardSnapshot> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<ApiHome>>("/v2/home", {
      token: session?.token ?? null,
    });
    return {
      cardStock: res.data.cardStock,
      visits: res.data.visits,
    };
  }

  async listGates(): Promise<Gate[]> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<ApiGate[]>>("/v2/gates", {
      token: session?.token ?? null,
    });
    return res.data.map(toGate);
  }

  async getRfidKey(uid: string): Promise<string> {
    const session = await loadSession();
    const res = await request<RfidKeyResponse>(
      `/v2/rfid-key?uid=${encodeURIComponent(uid)}`,
      { token: session?.token ?? null },
    );
    return res.rfid_key;
  }

  async listDestinations(): Promise<Destination[]> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<ApiDestination[]>>(
      "/v2/destinations",
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
