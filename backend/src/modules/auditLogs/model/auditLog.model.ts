import { Schema, model, Document, Types } from "mongoose";

/**
 * Before/after snapshot for a mutating action
 */
export interface IAuditLogChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Interface for Audit Logs
 * Immutable audit trail for healthcare compliance
 */
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor?: Types.ObjectId; // Reference to users; optional (e.g. failed anonymous login)
  actorRole?: string; // Snapshot of role name at time of action
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "LOGIN" | "LOGOUT";
  resource: string; // "medicine", "inventory", "exchange_request", "user", ...
  resourceId?: Types.ObjectId;
  changes?: IAuditLogChanges;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  status: "success" | "failure";
  errorMessage?: string;
  hospital?: Types.ObjectId;
  branch?: Types.ObjectId;
  retentionUntil: Date;
  createdAt: Date;
}

const changesSchema = new Schema<IAuditLogChanges>(
  {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;

/**
 * Audit Log Schema
 * Immutable audit trail for healthcare compliance
 */
const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    actorRole: {
      type: String,
      trim: true,
    },

    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "LOGIN", "LOGOUT"],
        message: "Invalid action",
      },
      index: true,
    },

    resource: {
      type: String,
      required: [true, "Resource is required"],
      trim: true,
      lowercase: true,
    },

    resourceId: {
      type: Schema.Types.ObjectId,
    },

    changes: {
      type: changesSchema,
      required: false,
    },

    ipAddress: {
      type: String,
      trim: true,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User agent must not exceed 500 characters"],
    },

    sessionId: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["success", "failure"],
        message: "Status must be success or failure",
      },
      default: "success",
    },

    errorMessage: {
      type: String,
      trim: true,
      maxlength: [1000, "Error message must not exceed 1000 characters"],
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },

    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
    },

    retentionUntil: {
      type: Date,
      default: () => new Date(Date.now() + SEVEN_YEARS_MS),
      description: "When this log becomes eligible for deletion (default: 7 years)",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
  }
);

/**
 * Indexes
 */
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ hospital: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

/**
 * Immutability: audit logs may only be created, never modified.
 */
auditLogSchema.pre("updateOne", function (next) {
  next(new Error("Audit logs are immutable"));
});

auditLogSchema.pre("findOneAndUpdate", function (next) {
  next(new Error("Audit logs are immutable"));
});

/**
 * Static method: Recent activity for a resource
 */
auditLogSchema.statics.getResourceHistory = function (
  resource: string,
  resourceId: Types.ObjectId,
  limit: number = 50
) {
  return this.find({ resource, resourceId }).sort({ createdAt: -1 }).limit(limit);
};

/**
 * Static method: Recent activity for a hospital
 */
auditLogSchema.statics.getHospitalHistory = function (
  hospitalId: Types.ObjectId,
  limit: number = 100
) {
  return this.find({ hospital: hospitalId }).sort({ createdAt: -1 }).limit(limit);
};

/**
 * Audit Log Model
 */
export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
