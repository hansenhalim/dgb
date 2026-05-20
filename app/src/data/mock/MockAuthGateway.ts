import type { Session } from "@/domain/entities";
import { LoginError, type AuthGateway, type ScannedCard } from "@/domain/ports";

import {
  clearSession,
  loadSession,
  saveSession,
} from "@/data/auth/sessionStore";

import { delay } from "./latency";

const ACCEPTED_PIN = "123456";
const GUARD_UID = "3098B0A0";
const MOCK_GUARD_NAME = "M YANI";
const SESSION_HOURS = 8;
const RFID_KEY = "C0FFEE".repeat(32);

export class MockAuthGateway implements AuthGateway {
  async login(pin: string, card: ScannedCard): Promise<Session> {
    // 1. POST /api/auth/lookup-uid → 404 unless UID is assigned to a guard.
    await delay(120);
    if (card.uid.toUpperCase() !== GUARD_UID) {
      throw new LoginError("uid_not_found", "Kartu tidak terdaftar.");
    }

    // 2. verify-pin
    await delay(150);
    if (pin !== ACCEPTED_PIN) {
      throw new LoginError("invalid_pin", "PIN salah.");
    }

    // 3. READ card for secret
    try {
      await card.readSecret(RFID_KEY);
    } catch (e) {
      throw new LoginError(
        "card_read_failed",
        e instanceof Error ? e.message : "Gagal membaca kartu.",
      );
    }

    // 4. verify-secret → token
    await delay(150);
    const session: Session = {
      token: `mock|${Math.random().toString(36).slice(2)}`,
      validUntil: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
      guardName: MOCK_GUARD_NAME,
    };
    await saveSession(session);
    return session;
  }

  async currentSession(): Promise<Session | null> {
    return loadSession();
  }

  async logout(): Promise<void> {
    await delay(80);
    await clearSession();
  }
}
