import type {
  DiscoverOptions,
  RfidPeripheral,
  RfidReader,
  RfidReaderStatus,
  RfidStatusListener,
  ScannedCard,
} from "@/domain/ports";

const CONNECTED_BATTERY = 85;

const FAKE_PERIPHERALS: RfidPeripheral[] = [
  { id: "DE:AD:BE:EF:00:01", name: "P3VC-RFID-01", rssi: -42 },
  { id: "DE:AD:BE:EF:00:02", name: "P3VC-RFID-02", rssi: -68 },
  { id: "DE:AD:BE:EF:00:03", name: "P3VC-RFID-03", rssi: -85 },
];

const FAKE_UID = "3098B0A0";
const FAKE_SECRET = "0".repeat(1024); // Blank card — triggers the new-visitor flow on home scan.

function abortError(): Error {
  const e = new Error("Dibatalkan.");
  e.name = "AbortError";
  return e;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort);
  });
}

export class MockRfidReader implements RfidReader {
  private status: RfidReaderStatus = {
    state: "disconnected",
    batteryPercent: null,
  };
  private pairedId: string | null = null;
  private pairedName: string | null = null;
  private statusListeners = new Set<RfidStatusListener>();

  getStatus(): RfidReaderStatus {
    return this.status;
  }

  async discover(options?: DiscoverOptions): Promise<RfidPeripheral[]> {
    const signal = options?.signal;
    const onUpdate = options?.onUpdate;
    const found: RfidPeripheral[] = [];
    try {
      for (const p of FAKE_PERIPHERALS) {
        await delay(300, signal);
        found.push(p);
        if (onUpdate) onUpdate([...found]);
      }
    } catch (e) {
      if (signal?.aborted) return found;
      throw e;
    }
    return found;
  }

  async pair(peripheralId: string): Promise<void> {
    const found = FAKE_PERIPHERALS.find((p) => p.id === peripheralId);
    if (!found) {
      throw new Error(`Unknown peripheral: ${peripheralId}`);
    }
    this.pairedId = peripheralId;
    this.pairedName = found.name;
    await this.connect();
  }

  getPairedPeripheralId(): string | null {
    return this.pairedId;
  }

  getPairedPeripheralName(): string | null {
    return this.pairedName;
  }

  async forget(): Promise<void> {
    await this.disconnect();
    this.pairedId = null;
    this.pairedName = null;
  }

  async connect(): Promise<void> {
    if (!this.pairedId) {
      throw new Error("No reader paired");
    }
    this.setStatus({ state: "connecting", batteryPercent: null });
    await new Promise((r) => setTimeout(r, 200));
    this.setStatus({ state: "connected", batteryPercent: CONNECTED_BATTERY });
  }

  async disconnect(): Promise<void> {
    this.setStatus({ state: "disconnected", batteryPercent: null });
  }

  onStatusChange(listener: RfidStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async readConnectedRssi(): Promise<number | null> {
    return null;
  }

  async scanCard(signal?: AbortSignal): Promise<ScannedCard> {
    if (this.status.state !== "connected") {
      throw new Error("Reader tidak terhubung.");
    }
    await delay(600, signal);
    return {
      uid: FAKE_UID,
      async readSecret(_key: string): Promise<string> {
        await new Promise((r) => setTimeout(r, 200));
        return FAKE_SECRET;
      },
    };
  }

  async writeCard(_key: string, _hexData: string): Promise<void> {
    if (this.status.state !== "connected") {
      throw new Error("Reader tidak terhubung.");
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  /** Dev helper — simulate reader battery drain from UI or tests. */
  setBatteryPercent(batteryPercent: number | null): void {
    this.setStatus({ ...this.status, batteryPercent });
  }

  private setStatus(next: RfidReaderStatus): void {
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }
}
