import type { VisitHistoryEntry } from "@/domain/entities";
import type {
  CardStateResponse,
  CreateVisitInput,
  CreateVisitResult,
  PulseGateInput,
  VisitsGateway,
} from "@/domain/ports";
import { gateAreaResult, type GateDirection } from "@/domain/gateAreaMap";
import type { CardArea } from "@/domain/visitCard";

import { delay } from "./latency";

function fakeUuid(): string {
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, "0");
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}

function mockState(
  gateId: number,
  direction: GateDirection,
  fallback: CardArea,
): CardStateResponse {
  const result = gateAreaResult(gateId, direction);
  // "wipe" never reaches transit/transit-enter (checkout has its own endpoint),
  // so we coerce to the fallback area for any malformed mock call.
  const currentArea: CardArea =
    typeof result === "string" && result !== "wipe" ? result : fallback;
  return { currentArea, updatedAt: Date.now() };
}

export class MockVisitsGateway implements VisitsGateway {
  async create(input: CreateVisitInput): Promise<CreateVisitResult> {
    await delay(400);
    return {
      visitId: fakeUuid(),
      ...mockState(input.gateId, "in", "VIL_1"),
    };
  }

  async pulseGate(_input: PulseGateInput): Promise<void> {
    await delay(120);
  }

  async checkout(_visitId: string, _gateId: number): Promise<void> {
    await delay(200);
  }

  async transit(_visitId: string, gateId: number): Promise<CardStateResponse> {
    await delay(200);
    return mockState(gateId, gateId === 4 ? "out" : "transit", "TRNST");
  }

  async transitEnter(
    _visitId: string,
    gateId: number,
  ): Promise<CardStateResponse> {
    await delay(200);
    return mockState(gateId, "in", "VIL_1");
  }

  async getHistory(_gateId: number): Promise<VisitHistoryEntry[]> {
    await delay(250);
    const now = Date.now();
    const minutes = (n: number) => now - n * 60_000;
    return [
      {
        id: fakeUuid(),
        vehiclePlateNumber: "B 1234 XY",
        currentPosition: "VIL_1",
        destinationName: "A-47",
        createdAt: minutes(2),
      },
      {
        id: fakeUuid(),
        vehiclePlateNumber: "BE 1199 AA",
        currentPosition: "VIL_1",
        destinationName: "AA-1",
        createdAt: minutes(18),
      },
      {
        id: fakeUuid(),
        vehiclePlateNumber: "F 9988 JK",
        currentPosition: "VIL_2",
        destinationName: "C-32",
        createdAt: minutes(45),
      },
      {
        id: fakeUuid(),
        vehiclePlateNumber: "D 4421 KL",
        currentPosition: "OUT",
        destinationName: "AB-2",
        createdAt: minutes(120),
      },
    ];
  }
}
