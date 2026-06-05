import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  type Device,
  type Subscription,
} from "react-native-ble-plx";

import type {
  DiscoverOptions,
  RfidPeripheral,
  RfidReader,
  RfidReaderStatus,
  RfidStatusListener,
  ScannedCard,
} from "@/domain/ports";

const NUS_SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const NUS_RX_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
const NUS_TX_CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

const PAIRED_ID_KEY = "rfid.pairedPeripheralId";
const PAIRED_NAME_KEY = "rfid.pairedPeripheralName";

const DISCOVER_WINDOW_MS = 30000;
const SCAN_TIMEOUT_MS = 15000;
const READ_TIMEOUT_MS = 10000;
const WRITE_TIMEOUT_MS = 10000;
const SCAN_POLL_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 8000;
const TARGET_MTU = 247;

type Waiter = {
  resolve: (line: string) => void;
  reject: (err: Error) => void;
};

type ScanSlot = {
  abort: AbortController;
  promise: Promise<ScannedCard>;
  customReason: Error | null;
};

type DiscoverSlot = {
  abort: AbortController;
  promise: Promise<RfidPeripheral[]>;
};

function abortError(): Error {
  const e = new Error("Dibatalkan.");
  e.name = "AbortError";
  return e;
}

function asciiToBase64(s: string): string {
  return globalThis.btoa(s);
}

function base64ToAscii(b64: string): string {
  return globalThis.atob(b64);
}

function mapNusError(line: string): string {
  const match = line.match(/^ERR\s+(\S+)/);
  const code = match?.[1];
  if (code === "NO_TAG_DURING_READ") {
    return "Kartu terlepas saat membaca. Coba lagi.";
  }
  if (code === "AUTH_FAILED") {
    return "Kunci kartu tidak cocok. Hubungi operator.";
  }
  if (code === "WRITE_FAIL") {
    return "Gagal menulis ke kartu. Pastikan kartu menempel di reader.";
  }
  if (code && /^(INVALID_|MISSING_|UNKNOWN_|PARSE_)/.test(code)) {
    return `Perintah tidak valid: ${code}`;
  }
  return `Reader: ${line.slice(4).trim()}`;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort);
  });
}

export class BleRfidReader implements RfidReader {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private notifySub: Subscription | null = null;
  private disconnectSub: Subscription | null = null;
  private rxBuffer = "";
  private waiter: Waiter | null = null;

  private status: RfidReaderStatus = {
    state: "disconnected",
    batteryPercent: null,
  };
  private statusListeners = new Set<RfidStatusListener>();

  private pairedId: string | null = null;
  private pairedName: string | null = null;

  private inflightConnect: Promise<void> | null = null;
  private inflightScan: ScanSlot | null = null;
  private inflightDiscover: DiscoverSlot | null = null;

  private expectedDisconnect = false;

  constructor() {
    Promise.all([
      SecureStore.getItemAsync(PAIRED_ID_KEY),
      SecureStore.getItemAsync(PAIRED_NAME_KEY),
    ])
      .then(([id, name]) => {
        this.pairedId = id;
        this.pairedName = name;
        if (id && this.status.state === "disconnected") {
          this.connect().catch(() => {});
        }
      })
      .catch(() => {});
  }

  getStatus(): RfidReaderStatus {
    return this.status;
  }

  getPairedPeripheralId(): string | null {
    return this.pairedId;
  }

  getPairedPeripheralName(): string | null {
    return this.pairedName;
  }

  onStatusChange(listener: RfidStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async discover(options?: DiscoverOptions): Promise<RfidPeripheral[]> {
    if (this.status.state !== "disconnected") {
      throw new Error("Putuskan reader sebelum memindai.");
    }

    if (this.inflightDiscover) {
      this.inflightDiscover.abort.abort();
      try {
        await this.inflightDiscover.promise;
      } catch {}
    }

    await this.ensurePermissions();

    const userSignal = options?.signal;
    const onUpdate = options?.onUpdate;
    const abort = new AbortController();
    const onUserAbort = () => abort.abort();
    if (userSignal) {
      if (userSignal.aborted) throw abortError();
      userSignal.addEventListener("abort", onUserAbort);
    }

    const manager = this.getManager();
    const found = new Map<string, RfidPeripheral>();

    const promise = new Promise<RfidPeripheral[]>((resolve, reject) => {
      let stopped = false;

      const stop = (err?: Error) => {
        if (stopped) return;
        stopped = true;
        try {
          manager.stopDeviceScan();
        } catch {}
        clearTimeout(timeoutId);
        abort.signal.removeEventListener("abort", onAbort);
        if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
        if (this.inflightDiscover?.abort === abort) {
          this.inflightDiscover = null;
        }
        if (err) reject(err);
        else resolve([...found.values()]);
      };

      const onAbort = () => stop();
      abort.signal.addEventListener("abort", onAbort);

      const timeoutId = setTimeout(() => stop(), DISCOVER_WINDOW_MS);

      try {
        manager.startDeviceScan(
          [NUS_SERVICE_UUID],
          { allowDuplicates: true },
          (error, device) => {
            if (error) {
              stop(error instanceof Error ? error : new Error(String(error)));
              return;
            }
            if (!device) return;
            const prev = found.get(device.id);
            const incomingRssi = device.rssi ?? null;
            const name = device.name ?? device.localName ?? "Reader";
            const rssi =
              prev?.rssi != null && incomingRssi != null
                ? Math.max(prev.rssi, incomingRssi)
                : (incomingRssi ?? prev?.rssi ?? null);
            found.set(device.id, { id: device.id, name, rssi });
            if (onUpdate) onUpdate([...found.values()]);
          },
        );
      } catch (e) {
        stop(e instanceof Error ? e : new Error(String(e)));
      }
    });

    this.inflightDiscover = { abort, promise };
    return promise;
  }

  async pair(peripheralId: string): Promise<void> {
    if (this.device && this.pairedId && this.pairedId !== peripheralId) {
      await this.disconnect();
    }

    const previousId = this.pairedId;
    const previousName = this.pairedName;
    this.pairedId = peripheralId;
    this.pairedName = null;
    await SecureStore.setItemAsync(PAIRED_ID_KEY, peripheralId);
    await SecureStore.deleteItemAsync(PAIRED_NAME_KEY).catch(() => {});

    try {
      await this.connect();
    } catch (e) {
      this.pairedId = previousId;
      this.pairedName = previousName;
      if (previousId) {
        await SecureStore.setItemAsync(PAIRED_ID_KEY, previousId).catch(
          () => {},
        );
      } else {
        await SecureStore.deleteItemAsync(PAIRED_ID_KEY).catch(() => {});
      }
      if (previousName) {
        await SecureStore.setItemAsync(PAIRED_NAME_KEY, previousName).catch(
          () => {},
        );
      }
      throw e;
    }
  }

  async forget(): Promise<void> {
    if (this.inflightScan) {
      this.inflightScan.customReason = new Error("Reader dilepas.");
      this.inflightScan.abort.abort();
    }
    this.expectedDisconnect = true;
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {}
    }
    await this.tearDownConnection();
    this.pairedId = null;
    this.pairedName = null;
    await SecureStore.deleteItemAsync(PAIRED_ID_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(PAIRED_NAME_KEY).catch(() => {});
    this.setStatus({ state: "disconnected", batteryPercent: null });
    this.expectedDisconnect = false;
  }

  async connect(): Promise<void> {
    if (this.status.state === "connected") return;
    if (this.inflightConnect) return this.inflightConnect;

    if (!this.pairedId) {
      throw new Error("No reader paired");
    }

    const id = this.pairedId;
    this.inflightConnect = (async () => {
      try {
        await this.doConnect(id);
      } finally {
        this.inflightConnect = null;
      }
    })();
    return this.inflightConnect;
  }

  async disconnect(): Promise<void> {
    if (this.inflightScan) {
      this.inflightScan.abort.abort();
    }
    this.expectedDisconnect = true;
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {}
    }
    await this.tearDownConnection();
    this.setStatus({ state: "disconnected", batteryPercent: null });
    this.expectedDisconnect = false;
  }

  async readConnectedRssi(): Promise<number | null> {
    if (this.status.state !== "connected" || !this.device) return null;
    try {
      const updated = await this.device.readRSSI();
      return updated.rssi ?? null;
    } catch {
      return null;
    }
  }

  async writeCard(key: string, hexData: string): Promise<void> {
    if (this.status.state !== "connected") {
      throw new Error("Reader tidak terhubung.");
    }
    if (!/^[0-9A-Fa-f]{192}$/.test(key)) {
      throw new Error("Kunci kartu tidak valid.");
    }
    if (!/^[0-9A-Fa-f]{1024}$/.test(hexData)) {
      throw new Error("Data kartu tidak valid.");
    }
    const ctrl = new AbortController();
    const resp = await this.request(
      `WRITE ${key} ${hexData}`,
      WRITE_TIMEOUT_MS,
      ctrl.signal,
    );
    if (resp.startsWith("OK WRITE_DONE")) return;
    if (resp.startsWith("ERR ")) {
      throw new Error(mapNusError(resp));
    }
    throw new Error("Balasan tidak dikenal: " + resp);
  }

  async scanCard(userSignal?: AbortSignal): Promise<ScannedCard> {
    if (this.inflightScan) {
      throw new Error("Pemindaian sebelumnya masih berjalan.");
    }
    if (this.status.state !== "connected") {
      throw new Error("Reader tidak terhubung.");
    }

    const abort = new AbortController();
    let timedOut = false;

    const onUserAbort = () => abort.abort();
    if (userSignal) {
      if (userSignal.aborted) throw abortError();
      userSignal.addEventListener("abort", onUserAbort);
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, SCAN_TIMEOUT_MS);

    const slot: ScanSlot = {
      abort,
      promise: null as never,
      customReason: null,
    };
    this.inflightScan = slot;

    const promise = (async () => {
      try {
        while (!abort.signal.aborted) {
          const resp = await this.request(
            "SCAN_UID",
            REQUEST_TIMEOUT_MS,
            abort.signal,
          );
          if (resp.startsWith("OK UID ")) {
            const uid = resp.slice("OK UID ".length).trim();
            return this.makeScannedCard(uid);
          }
          if (/^ERR\s+NO_TAG\b/.test(resp)) {
            await delay(SCAN_POLL_INTERVAL_MS, abort.signal);
            continue;
          }
          if (resp.startsWith("ERR ")) {
            throw new Error(mapNusError(resp));
          }
          throw new Error("Balasan tidak dikenal: " + resp);
        }
        if (slot.customReason) throw slot.customReason;
        if (timedOut) throw new Error("Tidak ada kartu terdeteksi.");
        throw abortError();
      } catch (e) {
        if (abort.signal.aborted) {
          if (slot.customReason) throw slot.customReason;
          if (timedOut) throw new Error("Tidak ada kartu terdeteksi.");
          throw abortError();
        }
        throw e;
      } finally {
        clearTimeout(timeoutId);
        if (userSignal) userSignal.removeEventListener("abort", onUserAbort);
        if (this.inflightScan === slot) this.inflightScan = null;
      }
    })();

    slot.promise = promise;
    return promise;
  }

  private makeScannedCard(uid: string): ScannedCard {
    const reader = this;
    return {
      uid,
      async readSecret(key: string): Promise<string> {
        const ctrl = new AbortController();
        const resp = await reader.request(
          `READ ${key}`,
          READ_TIMEOUT_MS,
          ctrl.signal,
        );
        if (resp.startsWith("OK DATA ")) {
          return resp.slice("OK DATA ".length).trim();
        }
        if (resp.startsWith("ERR ")) {
          throw new Error(mapNusError(resp));
        }
        throw new Error("Balasan tidak dikenal: " + resp);
      },
    };
  }

  private async doConnect(id: string): Promise<void> {
    await this.ensurePermissions();
    const manager = this.getManager();
    this.setStatus({ state: "connecting", batteryPercent: null });

    let device: Device | null = null;
    try {
      device = await manager.connectToDevice(id, {
        timeout: CONNECT_TIMEOUT_MS,
      });
      await device.discoverAllServicesAndCharacteristics();
      try {
        await device.requestMTU(TARGET_MTU);
      } catch {}

      this.notifySub = device.monitorCharacteristicForService(
        NUS_SERVICE_UUID,
        NUS_TX_CHAR_UUID,
        (err, characteristic) => {
          if (err) return;
          if (!characteristic?.value) return;
          this.handleNotify(base64ToAscii(characteristic.value));
        },
      );

      this.disconnectSub = device.onDisconnected(() => {
        this.handleUnexpectedDisconnect();
      });

      this.device = device;
      const discoveredName = device.name ?? device.localName ?? null;
      if (discoveredName && discoveredName !== this.pairedName) {
        this.pairedName = discoveredName;
        SecureStore.setItemAsync(PAIRED_NAME_KEY, discoveredName).catch(
          () => {},
        );
      }
      this.setStatus({ state: "connected", batteryPercent: null });
    } catch (e) {
      if (device) {
        try {
          await device.cancelConnection();
        } catch {}
      }
      await this.tearDownConnection();
      this.setStatus({ state: "disconnected", batteryPercent: null });
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  private handleNotify(chunk: string): void {
    this.rxBuffer += chunk;
    let idx: number;
    while ((idx = this.rxBuffer.indexOf("\n")) !== -1) {
      const line = this.rxBuffer.slice(0, idx).replace(/\r$/, "").trim();
      this.rxBuffer = this.rxBuffer.slice(idx + 1);
      if (!line) continue;
      if (line.startsWith("EVT ")) {
        this.handleEvent(line);
        continue;
      }
      const w = this.waiter;
      if (w) {
        this.waiter = null;
        w.resolve(line);
      }
    }
  }

  private handleEvent(line: string): void {
    const battMatch = line.match(/^EVT\s+BATT\s+(\d+)/);
    if (battMatch) {
      const pct = parseInt(battMatch[1], 10);
      if (Number.isFinite(pct)) {
        const clamped = Math.max(0, Math.min(100, pct));
        this.setStatus({ ...this.status, batteryPercent: clamped });
      }
    }
  }

  private handleUnexpectedDisconnect(): void {
    if (this.expectedDisconnect) return;

    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.reject(new Error("Reader terputus."));
    }
    if (this.inflightScan) {
      this.inflightScan.customReason = new Error("Reader terputus.");
      this.inflightScan.abort.abort();
    }

    this.tearDownConnection();

    const id = this.pairedId;
    if (id && !this.inflightConnect) {
      this.inflightConnect = (async () => {
        try {
          await this.doConnect(id);
        } catch {
          // one-shot: leave at disconnected
        } finally {
          this.inflightConnect = null;
        }
      })();
      this.inflightConnect.catch(() => {});
    } else if (!id) {
      this.setStatus({ state: "disconnected", batteryPercent: null });
    }
  }

  private async tearDownConnection(): Promise<void> {
    if (this.notifySub) {
      try {
        this.notifySub.remove();
      } catch {}
      this.notifySub = null;
    }
    if (this.disconnectSub) {
      try {
        this.disconnectSub.remove();
      } catch {}
      this.disconnectSub = null;
    }
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.reject(new Error("Reader terputus."));
    }
    this.device = null;
    this.rxBuffer = "";
  }

  private request(
    line: string,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      if (this.status.state !== "connected" || !this.device) {
        reject(new Error("Reader tidak terhubung."));
        return;
      }
      if (this.waiter) {
        reject(new Error("Pemindaian sebelumnya masih berjalan."));
        return;
      }

      const device = this.device;
      let settled = false;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        signal.removeEventListener("abort", onAbort);
        if (this.waiter === waiter) this.waiter = null;
      };
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const waiter: Waiter = {
        resolve: (resp) => finish(() => resolve(resp)),
        reject: (err) => finish(() => reject(err)),
      };
      // Commands are strictly serialized (one waiter at a time), so any bytes
      // still buffered here are an un-terminated fragment left over from a
      // timed-out/aborted/interrupted prior exchange. Drop them before issuing
      // this command, otherwise the next '\n' resolves us with stale+new data
      // concatenated (e.g. corrupting a READ's 1024-hex DATA reply).
      this.rxBuffer = "";
      this.waiter = waiter;

      const timeoutId = setTimeout(
        () => waiter.reject(new Error("Waktu habis menunggu balasan reader.")),
        timeoutMs,
      );
      const onAbort = () => waiter.reject(abortError());
      signal.addEventListener("abort", onAbort);

      // The NUS firmware does not support BLE Long Write — chunk manually
      // into MTU-3 sized writes, with the final chunk terminated by '\n'.
      this.writeChunked(device, line + "\n").catch((err) =>
        waiter.reject(err instanceof Error ? err : new Error(String(err))),
      );
    });
  }

  private async writeChunked(device: Device, payload: string): Promise<void> {
    const mtu =
      typeof device.mtu === "number" && device.mtu > 0
        ? device.mtu
        : TARGET_MTU;
    const chunkSize = Math.max(1, mtu - 3);
    for (let offset = 0; offset < payload.length; offset += chunkSize) {
      const chunk = payload.slice(offset, offset + chunkSize);
      await device.writeCharacteristicWithoutResponseForService(
        NUS_SERVICE_UUID,
        NUS_RX_CHAR_UUID,
        asciiToBase64(chunk),
      );
    }
  }

  private async ensurePermissions(): Promise<void> {
    const sdk =
      typeof Platform.Version === "number"
        ? Platform.Version
        : parseInt(String(Platform.Version), 10);
    const perms: string[] = [];
    if (sdk >= 31) {
      perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      perms.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    } else {
      perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    const result = await PermissionsAndroid.requestMultiple(
      perms as Parameters<typeof PermissionsAndroid.requestMultiple>[0],
    );
    const allGranted = perms.every(
      (p) =>
        result[p as keyof typeof result] === PermissionsAndroid.RESULTS.GRANTED,
    );
    if (!allGranted) {
      throw new Error("Izinkan akses Bluetooth untuk memindai reader.");
    }
  }

  private getManager(): BleManager {
    if (!this.manager) {
      this.manager = new BleManager();
    }
    return this.manager;
  }

  private setStatus(next: RfidReaderStatus): void {
    this.status = next;
    this.statusListeners.forEach((l) => l(next));
  }
}
