import { createHash } from "crypto";

/**
 * Hash a raw token (e.g. a refresh token JWT) before persisting it,
 * so a database leak alone doesn't expose usable tokens.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
