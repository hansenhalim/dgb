import { loadSession } from "@/data/auth/sessionStore";
import type { VisitHistoryEntry } from "@/domain/entities";
import type {
  CardStateResponse,
  CreateVisitInput,
  CreateVisitResult,
  PulseGateInput,
  VisitsGateway,
} from "@/domain/ports";
import { ENUM_BY_AREA, type CardArea, type VisitPosition } from "@/domain/visitCard";

import { request, type ApiEnvelope } from "./httpClient";

type VisitHistoryWire = {
  id: string;
  vehicle_plate_number: string;
  current_position: string;
  destination_name: string;
  created_at: string;
};

type CardStateWire = {
  current_area: string;
  updated_at: string;
};

type CreateVisitResponseData = {
  id: string;
  payload?: { visit_id?: string } & Partial<CardStateWire>;
} & Partial<CardStateWire>;

function parseCardArea(value: string): CardArea {
  // Lookup-by-string: ENUM_BY_AREA's keys are the valid CardArea strings.
  if (!(value in ENUM_BY_AREA)) {
    throw new Error(`Server returned unknown current_area: ${value}`);
  }
  return value as CardArea;
}

function parseVisitPosition(value: string): VisitPosition {
  // Visit-history positions are CardArea ∪ {"OUT"} — OUT is the post-checkout state.
  if (value !== "OUT" && !(value in ENUM_BY_AREA)) {
    throw new Error(`Server returned unknown current_position: ${value}`);
  }
  return value as VisitPosition;
}

function parseUpdatedAt(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`Server returned invalid updated_at: ${value}`);
  }
  return ms;
}

function parseCardState(wire: Partial<CardStateWire>): CardStateResponse {
  if (!wire.current_area || !wire.updated_at) {
    throw new Error("Server response missing current_area or updated_at.");
  }
  return {
    currentArea: parseCardArea(wire.current_area),
    updatedAt: parseUpdatedAt(wire.updated_at),
  };
}

export class ApiVisitsGateway implements VisitsGateway {
  async create(input: CreateVisitInput): Promise<CreateVisitResult> {
    const session = await loadSession();
    const form = new FormData();
    form.append("uid", input.uid);
    form.append("identity_number", input.identityNumber);
    form.append("fullname", input.fullname);
    if (input.vehiclePlateNumber.length > 0) {
      form.append("vehicle_plate_number", input.vehiclePlateNumber);
    }
    form.append("purpose_of_visit", input.purposeOfVisit);
    form.append("destination_name", input.destinationName);
    form.append("gate_id", String(input.gateId));
    form.append(
      "identity_photo",
      // RN-specific FormData file shape (uri/name/type) — not Blob.
      {
        uri: input.photoUri,
        name: "identity.jpg",
        type: "image/jpeg",
      } as unknown as Blob,
    );

    const res = await request<ApiEnvelope<CreateVisitResponseData>>(
      "/api/visits",
      {
        method: "POST",
        body: form,
        token: session?.token ?? null,
      },
    );
    const visitId = res.data.payload?.visit_id ?? res.data.id;
    if (!visitId) {
      throw new Error("Server did not return a visit id.");
    }
    // Card-state may sit at either the envelope root or nested under `payload`.
    const stateWire: Partial<CardStateWire> = {
      current_area: res.data.payload?.current_area ?? res.data.current_area,
      updated_at: res.data.payload?.updated_at ?? res.data.updated_at,
    };
    return { visitId, ...parseCardState(stateWire) };
  }

  async pulseGate(input: PulseGateInput): Promise<void> {
    const session = await loadSession();
    await request<unknown>(`/api/gates/${input.gateId}/pulse`, {
      method: "POST",
      body: JSON.stringify({
        visit_id: input.visitId,
        direction: input.direction,
      }),
      token: session?.token ?? null,
    });
  }

  async checkout(visitId: string): Promise<void> {
    const session = await loadSession();
    await request<unknown>(`/api/visits/${visitId}/checkout`, {
      method: "POST",
      token: session?.token ?? null,
    });
  }

  async transit(visitId: string, gateId: number): Promise<CardStateResponse> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<CardStateWire>>(
      `/api/visits/${visitId}/transit`,
      {
        method: "POST",
        body: JSON.stringify({ gate_id: gateId }),
        token: session?.token ?? null,
      },
    );
    return parseCardState(res.data);
  }

  async transitEnter(
    visitId: string,
    gateId: number,
  ): Promise<CardStateResponse> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<CardStateWire>>(
      `/api/visits/${visitId}/transit-enter`,
      {
        method: "POST",
        body: JSON.stringify({ gate_id: gateId }),
        token: session?.token ?? null,
      },
    );
    return parseCardState(res.data);
  }

  async getHistory(gateId: number): Promise<VisitHistoryEntry[]> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<VisitHistoryWire[]>>(
      `/api/visits/history?gate_id=${gateId}`,
      { token: session?.token ?? null },
    );
    return res.data.map((wire) => {
      const createdAt = Date.parse(wire.created_at);
      if (!Number.isFinite(createdAt)) {
        throw new Error(`Server returned invalid created_at: ${wire.created_at}`);
      }
      return {
        id: wire.id,
        vehiclePlateNumber: wire.vehicle_plate_number,
        currentPosition: parseVisitPosition(wire.current_position),
        destinationName: wire.destination_name,
        createdAt,
      };
    });
  }
}
