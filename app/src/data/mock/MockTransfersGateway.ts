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
  // A pending request involves exactly two gates; the API guarantees one pending per gate.
  private pending: TransferRequest[] = [
    {
      id: 1,
      fromGate: { id: 2, name: "Gerbang 2" },
      toGate: { id: 1, name: "Gerbang 1" },
      amount: 25,
    },
  ];
  private nextId = 2;

  async getPending(gateId: number): Promise<TransferRequest | null> {
    await delay(150);
    const found = this.pending.find(
      (r) => r.fromGate.id === gateId || r.toGate.id === gateId,
    );
    return found ?? null;
  }

  async create(input: CreateTransferInput): Promise<void> {
    await delay(250);
    const conflict = this.pending.find(
      (r) =>
        r.fromGate.id === input.fromGateId ||
        r.toGate.id === input.fromGateId ||
        r.fromGate.id === input.toGateId ||
        r.toGate.id === input.toGateId,
    );
    if (conflict) {
      throw new Error("Invalid request data or transfer already pending.");
    }
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
