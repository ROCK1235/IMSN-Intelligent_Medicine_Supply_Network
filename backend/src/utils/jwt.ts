import jwt, { SignOptions } from "jsonwebtoken";

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  hospital?: string;
  branch?: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

function getAccessSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not defined in environment variables");
  }
  return secret;
}

const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY ||
  "15m") as SignOptions["expiresIn"];
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY ||
  "7d") as SignOptions["expiresIn"];

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
}

/**
 * Absolute expiry Date for a freshly issued refresh token, derived from
 * REFRESH_TOKEN_EXPIRY (e.g. "7d", "12h", "30m", "45s"). Used to populate
 * RefreshToken.expiresAt for the DB record backing the JWT.
 */
export function getRefreshTokenExpiry(): Date {
  const raw = process.env.REFRESH_TOKEN_EXPIRY || "7d";
  return new Date(Date.now() + parseDurationToMs(raw));
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  const FALLBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  if (!match) return FALLBACK_MS;

  const value = Number(match[1]);
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * unitMs[match[2]];
}
