import * as Device from "expo-device";

import { clearSession, loadSession, saveSession } from "@/data/auth/sessionStore";
import type { Session } from "@/domain/entities";
import {
  LoginError,
  type AuthGateway,
  type ScannedCard,
} from "@/domain/ports";

import { HttpError, request } from "./httpClient";

type LookupUidResponse = { message: string; guard_name: string };
type VerifyPinResponse = { message: string; rfid_key: string };
type VerifySecretResponse = {
  message: string;
  token: string;
  valid_until: string;
};

function deviceName(): string {
  return Device.deviceName ?? Device.modelName ?? "Unknown Device";
}

export class ApiAuthGateway implements AuthGateway {
  async login(pin: string, card: ScannedCard): Promise<Session> {
    let guardName: string;
    try {
      const res = await request<LookupUidResponse>("/api/auth/lookup-uid", {
        method: "POST",
        body: JSON.stringify({ uid: card.uid }),
      });
      guardName = res.guard_name;
    } catch (e) {
      throw wrap(e, "uid_not_found", "Kartu tidak terdaftar.");
    }

    let rfidKey: string;
    try {
      const res = await request<VerifyPinResponse>("/api/auth/verify-pin", {
        method: "POST",
        body: JSON.stringify({ uid: card.uid, pin }),
      });
      rfidKey = res.rfid_key;
    } catch (e) {
      throw wrap(e, "invalid_pin", "PIN salah.");
    }

    let secretKey: string;
    try {
      secretKey = await card.readSecret(rfidKey);
    } catch (e) {
      throw new LoginError(
        "card_read_failed",
        e instanceof Error ? e.message : "Gagal membaca kartu.",
      );
    }

    let verified: VerifySecretResponse;
    try {
      verified = await request<VerifySecretResponse>(
        "/api/auth/verify-secret",
        {
          method: "POST",
          body: JSON.stringify({
            uid: card.uid,
            secret_key: secretKey,
            device_name: deviceName(),
          }),
        },
      );
    } catch (e) {
      throw wrap(e, "invalid_secret", "Kunci kartu tidak valid.");
    }

    const session: Session = {
      token: verified.token,
      validUntil: new Date(verified.valid_until),
      guardName,
    };
    await saveSession(session);
    return session;
  }

  async currentSession(): Promise<Session | null> {
    return loadSession();
  }

  async logout(): Promise<void> {
    const session = await loadSession();
    if (session) {
      try {
        await request<{ message: string }>("/api/auth/logout", {
          method: "POST",
          token: session.token,
        });
      } catch {
        // Ignore — even if server call fails, clear local state.
      }
    }
    await clearSession();
  }
}

function wrap(
  err: unknown,
  defaultCode: LoginError["code"],
  defaultMessage: string,
): LoginError {
  if (err instanceof HttpError) {
    return new LoginError(defaultCode, err.message || defaultMessage);
  }
  if (err instanceof Error) {
    return new LoginError("network", err.message);
  }
  return new LoginError("network", defaultMessage);
}
