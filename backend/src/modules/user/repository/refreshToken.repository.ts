import { Types } from "mongoose";
import { RefreshToken } from "../../refreshtoken/model/refreshtoken.model";

export interface CreateRefreshTokenData {
  token: string; // pre-hashed (sha256) — never store the raw JWT
  user: Types.ObjectId;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
}

/**
 * RefreshToken data-access layer, scoped to what the user module's auth
 * flows need (issue, look up, revoke).
 */

export function createRefreshToken(data: CreateRefreshTokenData) {
  return RefreshToken.create(data);
}

export function findByHashedToken(hashedToken: string) {
  return RefreshToken.findOne({ token: hashedToken });
}

export function revokeToken(hashedToken: string) {
  return RefreshToken.updateOne(
    { token: hashedToken, isRevoked: false },
    { $set: { isRevoked: true, revokedAt: new Date() } }
  );
}

export function revokeAllForUser(userId: Types.ObjectId | string) {
  return RefreshToken.updateMany(
    { user: userId, isRevoked: false },
    { $set: { isRevoked: true, revokedAt: new Date() } }
  );
}
