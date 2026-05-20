export type RfidReaderState = "disconnected" | "connecting" | "connected";

export type RfidReaderStatus = {
  state: RfidReaderState;
  /** Reader battery level 0–100. Null when the reader is not connected or has not reported yet. */
  batteryPercent: number | null;
};

export type RfidPeripheral = {
  id: string;
  name: string;
  /** BLE signal strength (dBm). Null for non-BLE transports. */
  rssi: number | null;
};

export type RfidStatusListener = (status: RfidReaderStatus) => void;

/**
 * A card currently held against the reader. UID is available immediately;
 * `readSecret` performs an authenticated READ of blocks 1,2 of each sector.
 */
export type ScannedCard = {
  uid: string;
  /**
   * Authenticate with the given sector-key hex (192 chars, 96 bytes) and read
   * the 1024-char (512-byte) payload from blocks 1,2 of each of the 16 sectors.
   */
  readSecret(key: string): Promise<string>;
};

export type DiscoverOptions = {
  /** Abort the scan early. The promise still resolves with whatever was found so far. */
  signal?: AbortSignal;
  /** Fires on each new peripheral with the cumulative deduped list. Useful for live UI. */
  onUpdate?: (peripherals: RfidPeripheral[]) => void;
};

export interface RfidReader {
  getStatus(): RfidReaderStatus;

  /** Scan for nearby readers. BLE: live scan over a short window. Serial: the plugged device. */
  discover(options?: DiscoverOptions): Promise<RfidPeripheral[]>;

  /** Save the chosen peripheral as the single paired reader and connect. */
  pair(peripheralId: string): Promise<void>;

  /** Currently-paired peripheral ID, or null if none. */
  getPairedPeripheralId(): string | null;

  /**
   * Cached friendly name of the currently-paired peripheral, or null if none / not yet known.
   * On BLE the name is captured on first successful connect and persisted alongside the ID.
   */
  getPairedPeripheralName(): string | null;

  /** Clear the paired peripheral (and disconnect). */
  forget(): Promise<void>;

  /** Connect to the currently-paired peripheral. Throws if none is paired. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  onStatusChange(listener: RfidStatusListener): () => void;

  /** Live RSSI of the currently-connected peripheral (BLE only); null on other transports or when disconnected. */
  readConnectedRssi(): Promise<number | null>;

  /** Wait for a card to be presented, then return its UID + a reader for its secret blocks. */
  scanCard(signal?: AbortSignal): Promise<ScannedCard>;

  /**
   * Write a 1024-char hex payload to the card currently on the reader, authenticated with `key`.
   * Caller is responsible for ensuring a card is present (no SCAN_UID is performed first).
   */
  writeCard(key: string, hexData: string): Promise<void>;
}
