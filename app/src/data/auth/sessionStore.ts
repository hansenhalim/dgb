import * as SecureStore from "expo-secure-store";

import type { Session } from "@/domain/entities";

const KEY = "dgb.session.v1";

type Persisted = {
  token: string;
  validUntil: string;
  guardName: string;
};

export async function saveSession(session: Session): Promise<void> {
  const payload: Persisted = {
    token: session.token,
    validUntil: session.validUntil.toISOString(),
    guardName: session.guardName,
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(payload));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Persisted;
    const validUntil = new Date(parsed.validUntil);
    if (Number.isNaN(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
      await clearSession();
      return null;
    }
    return {
      token: parsed.token,
      validUntil,
      guardName: parsed.guardName,
    };
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
