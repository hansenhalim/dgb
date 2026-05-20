export type ApiMode = "mock" | "real";
export type RfidTransport = "mock" | "ble" | "serial";

function readApiMode(): ApiMode {
  const raw = process.env.EXPO_PUBLIC_API_MODE;
  if (raw === "real") return "real";
  return "mock";
}

function readRfidTransport(): RfidTransport {
  const raw = process.env.EXPO_PUBLIC_RFID_TRANSPORT;
  if (raw === "ble" || raw === "serial") return raw;
  return "mock";
}

function readApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
}

export const env = {
  apiMode: readApiMode(),
  rfidTransport: readRfidTransport(),
  apiBaseUrl: readApiBaseUrl(),
} as const;
