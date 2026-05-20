import type { TransferRequest } from "../entities/TransferRequest";

export type CreateTransferInput = {
  fromGateId: number;
  toGateId: number;
  amount: number;
};

export type TransferRespondStatus = "confirm" | "reject";

export interface TransfersGateway {
  /** Returns the single pending request involving this gate, or null when none. */
  getPending(gateId: number): Promise<TransferRequest | null>;
  create(input: CreateTransferInput): Promise<void>;
  respond(id: number, status: TransferRespondStatus): Promise<void>;
}
