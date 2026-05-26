import { loadSession } from "@/data/auth/sessionStore";
import type { TransferRequest } from "@/domain/entities";
import type {
  CreateTransferInput,
  TransferRespondStatus,
  TransfersGateway,
} from "@/domain/ports";

import { request, type ApiEnvelope } from "./httpClient";

type GateWire = {
  id: number;
  name: string;
};

type TransferRequestWire = {
  id: number;
  from_gate: GateWire;
  to_gate: GateWire;
  amount: number;
};

function parseTransferRequest(wire: TransferRequestWire): TransferRequest {
  return {
    id: wire.id,
    fromGate: { id: wire.from_gate.id, name: wire.from_gate.name },
    toGate: { id: wire.to_gate.id, name: wire.to_gate.name },
    amount: wire.amount,
  };
}

export class ApiTransfersGateway implements TransfersGateway {
  async getPending(gateId: number): Promise<TransferRequest[]> {
    const session = await loadSession();
    const res = await request<ApiEnvelope<TransferRequestWire[]>>(
      `/v2/gates/${gateId}/transfer-requests`,
      { token: session?.token ?? null },
    );
    return res.data.map(parseTransferRequest);
  }

  async create(input: CreateTransferInput): Promise<void> {
    const session = await loadSession();
    await request<unknown>("/v2/transfer-requests", {
      method: "POST",
      body: JSON.stringify({
        from_gate: input.fromGateId,
        to_gate: input.toGateId,
        amount: input.amount,
      }),
      token: session?.token ?? null,
    });
  }

  async respond(id: number, status: TransferRespondStatus): Promise<void> {
    const session = await loadSession();
    await request<unknown>(`/v2/transfer-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      token: session?.token ?? null,
    });
  }
}
