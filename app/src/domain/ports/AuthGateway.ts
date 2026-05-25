import type { Session } from "../entities";
import type { ScannedCard } from "./RfidReader";

export class LoginError extends Error {
  constructor(
    public readonly code:
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
   * Runs the 3-step handshake:
   *   1. verify-pin    → rfid key (collapses unknown-UID and wrong-PIN into invalid_pin)
   *   2. READ card with key → secret bytes
   *   3. verify-secret → bearer token + expiry + guard name
   * Persists the session and returns it. Throws {@link LoginError} on failure.
   */
  login(pin: string, card: ScannedCard): Promise<Session>;

  /** Current active session (rehydrated from storage on cold start), or null. */
  currentSession(): Promise<Session | null>;

  /** Clear local session. Server-side has no token revocation — JWTs are stateless. */
  logout(): Promise<void>;
}
