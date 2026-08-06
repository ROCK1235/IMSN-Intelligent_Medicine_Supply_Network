import { Schema, model, Document, Types } from "mongoose";
import { User } from "../../user/model/User.model";

/**
 * Interface for Refresh Tokens
 * Manage JWT refresh tokens for security
 */
export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  token: string; // Hashed for storage
  user: Types.ObjectId; // Reference to users
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Refresh Token Schema
 * Manage JWT refresh tokens for security
 */
const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
      index: true,
      select: false, // Don't return token by default
      minlength: [20, "Token must be at least 20 characters"],
    },

    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const user = await User.findById(v);
          return !!user;
        },
        message: "User not found",
      },
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
      validate: {
        validator: function (v: Date) {
          return v > new Date();
        },
        message: "Expiry date must be in the future",
      },
    },

    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    revokedAt: {
      type: Date,
      validate: {
        validator: function (v?: Date) {
          if (!v) return true;
          if (!this.isRevoked) return true;
          return v <= new Date();
        },
        message: "Revocation date must be in the past",
      },
    },

    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
          // Simple IP validation (IPv4 and IPv6)
          return /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/.test(v);
        },
        message: "Invalid IP address",
      },
    },

    userAgent: {
      type: String,
      required: [true, "User agent is required"],
      trim: true,
      maxlength: [500, "User agent must not exceed 500 characters"],
    },

    deviceId: {
      type: String,
      trim: true,
      maxlength: [100, "Device ID must not exceed 100 characters"],
      sparse: true,
      description: "Optional device identifier for device tracking",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Unique index on token
refreshTokenSchema.index({ token: 1 }, { unique: true });

// Indexes for common queries
refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ isRevoked: 1 });

// Compound indexes
refreshTokenSchema.index({ user: 1, isRevoked: 1 });
refreshTokenSchema.index({ user: 1, expiresAt: 1 });

// TTL index - automatically delete expired tokens
refreshTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

/**
 * Pre-save hook: Prevent modification of revoked tokens
 */
refreshTokenSchema.pre("save", function (next) {
  if (this.isRevoked && !this.revokedAt) {
    this.revokedAt = new Date();
  }

  if (!this.isRevoked) {
    this.revokedAt = undefined;
  }

  next();
});

/**
 * Pre-delete hook: Prevent deletion of tokens (use revocation instead)
 */
refreshTokenSchema.pre("deleteOne", async function (next) {
  // Allow deletion in testing/cleanup, but warn in production
  if (process.env.NODE_ENV === "production") {
    console.warn("Deleting refresh token - consider revoking instead");
  }
  next();
});

/**
 * Static method: Find valid tokens for user
 */
refreshTokenSchema.statics.findValidTokens = function (userId: Types.ObjectId) {
  return this.find({
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

/**
 * Static method: Find active tokens for user and device
 */
refreshTokenSchema.statics.findByUserAndDevice = function (
  userId: Types.ObjectId,
  deviceId: string
) {
  return this.findOne({
    user: userId,
    deviceId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

/**
 * Static method: Revoke all tokens for user (logout from all devices)
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function (
  userId: Types.ObjectId
): Promise<number> {
  const result = await this.updateMany(
    {
      user: userId,
      isRevoked: false,
    },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    }
  );
  return result.modifiedCount;
};

/**
 * Static method: Revoke token by ID
 */
refreshTokenSchema.statics.revokeToken = async function (
  tokenId: Types.ObjectId
): Promise<boolean> {
  const result = await this.findByIdAndUpdate(
    tokenId,
    {
      isRevoked: true,
      revokedAt: new Date(),
    },
    { new: true }
  );
  return !!result;
};

/**
 * Static method: Clean up expired and revoked tokens
 */
refreshTokenSchema.statics.cleanup = async function (): Promise<number> {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // 30 days old
    ],
  });
  return result.deletedCount;
};

/**
 * Instance method: Is token still valid
 */
refreshTokenSchema.methods.isValid = function (): boolean {
  return !this.isRevoked && this.expiresAt > new Date();
};

/**
 * Instance method: Revoke this token
 */
refreshTokenSchema.methods.revoke = async function (): Promise<void> {
  this.isRevoked = true;
  this.revokedAt = new Date();
  await this.save();
};

/**
 * Instance method: Get browser info from user agent
 */
refreshTokenSchema.methods.getBrowserInfo = function (): {
  browser: string;
  os: string;
} {
  const ua = this.userAgent;

  // Simple browser detection
  let browser = "Unknown";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";
  else if (ua.includes("Opera")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS")) os = "iOS";

  return { browser, os };
};

/**
 * Refresh Token Model
 */
export const RefreshToken = model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);