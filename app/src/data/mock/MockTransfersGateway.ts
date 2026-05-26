import type { TransferRequest } from "@/domain/entities";
import type {
  CreateTransferInput,
  TransferRespondStatus,
  TransfersGateway,
} from "@/domain/ports";

import { delay } from "./latency";

const GATE_NAMES: Record<number, string> = {
  1: "Gerbang 1",
  2: "Gerbang 2",
  3: "Gerbang 3",
  4: "Gerbang 4",
};

export class MockTransfersGateway implements TransfersGateway {
  private pending: TransferRequest[] = [
    {
      id: 1,
      fromGate: { id: 2, name: "Gerbang 2" },
      toGate: { id: 1, name: "Gerbang 1" },
      amount: 25,
    },
  ];
  private nextId = 2;

  async getPending(gateId: number): Promise<TransferRequest[]> {
    await delay(150);
    return this.pending.filter(
      (r) => r.fromGate.id === gateId || r.toGate.id === gateId,
    );
  }

  async create(input: CreateTransferInput): Promise<void> {
    await delay(250);
    this.pending.push({
      id: this.nextId++,
      fromGate: {
        id: input.fromGateId,
        name: GATE_NAMES[input.fromGateId] ?? `Gerbang ${input.fromGateId}`,
      },
      toGate: {
        id: input.toGateId,
        name: GATE_NAMES[input.toGateId] ?? `Gerbang ${input.toGateId}`,
      },
      amount: input.amount,
    });
  }

  async respond(id: number, _status: TransferRespondStatus): Promise<void> {
    await delay(250);
    const idx = this.pending.findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error("Invalid status or request already processed.");
    }
    this.pending.splice(idx, 1);
  }
}
