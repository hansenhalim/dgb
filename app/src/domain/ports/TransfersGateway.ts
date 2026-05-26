import type { TransferRequest } from "../entities/TransferRequest";

export type CreateTransferInput = {
  fromGateId: number;
  toGateId: number;
  amount: number;
};

export type TransferRespondStatus = "confirm" | "reject";

export interface TransfersGateway {
  /** Returns all pending requests involving this gate. Empty array when none. */
  getPending(gateId: number): Promise<TransferRequest[]>;
  create(input: CreateTransferInput): Promise<void>;
  respond(id: number, status: TransferRespondStatus): Promise<void>;
}
