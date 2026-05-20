import type {
  DiscoverOptions,
  RfidPeripheral,
  RfidReader,
  RfidReaderStatus,
  RfidStatusListener,
  ScannedCard,
} from "@/domain/ports";

const NOT_IMPLEMENTED =
  "SerialRfidReader not implemented — wire up USB/serial native module here. " +
  "Wire protocol: SCAN_UID → 'OK UID <hex>'; READ <key> → 'OK DATA <hex_data>'.";

export class SerialRfidReader implements RfidReader {
  getStatus(): RfidReaderStatus {
    return { state: "disconnected", batteryPercent: null };
  }

  async discover(_options?: DiscoverOptions): Promise<RfidPeripheral[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async pair(_peripheralId: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  getPairedPeripheralId(): string | null {
    return null;
  }

  getPairedPeripheralName(): string | null {
    return null;
  }

  async forget(): Promise<void> {}

  async connect(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async disconnect(): Promise<void> {}

  onStatusChange(_listener: RfidStatusListener): () => void {
    return () => {};
  }

  async readConnectedRssi(): Promise<number | null> {
    return null;
  }

  async scanCard(_signal?: AbortSignal): Promise<ScannedCard> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async writeCard(_key: string, _hexData: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
