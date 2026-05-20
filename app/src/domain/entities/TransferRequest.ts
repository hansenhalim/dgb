export type TransferRequest = {
  id: number;
  fromGate: { id: number; name: string };
  toGate: { id: number; name: string };
  amount: number;
};
