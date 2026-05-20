import type { Session } from "../entities";
import type { ScannedCard } from "./RfidReader";

export class LoginError extends Error {
  constructor(
    public readonly code:
      | "uid_not_found"
      | "invalid_pin"
      | "card_read_failed"
      | "invalid_secret"
      | "network",
    message: string,
  ) {
    super(message);
    this.name = "LoginError";
  }
}

export interface AuthGateway {
  /**
   * Runs the full 3-step handshake:
   *   1. lookup-uid  → guard name
   *   2. verify-pin  → rfid key
   *   3. READ card with key → secret bytes
   *   4. verify-secret → bearer token + expiry
   * Persists the session and returns it. Throws {@link LoginError} on failure.
   */
  login(pin: string, card: ScannedCard): Promise<Session>;

  /** Current active session (rehydrated from storage on cold start), or null. */
  currentSession(): Promise<Session | null>;

  /** Invalidate the token server-side and clear local session. */
  logout(): Promise<void>;
}
