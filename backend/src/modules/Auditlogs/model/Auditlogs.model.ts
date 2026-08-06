import { Schema, model, Document, Types } from "mongoose";
import { User } from "../../user/model/User.model";
import { Hospital } from "../../hospitals/model/hospitals.model";

/**
 * Changes object interface for before/after state
 */
export interface IChanges {
  before?: Record<string, any>;
  after?: Record<string, any>;
}

/**
 * Interface for Audit Logs
 * Immutable audit trail for compliance and security
 */
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId; // Reference to users (who performed action)
  actorRole: string; // Snapshot of role at time of action
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "EXPORT";
  resource: string; // "medicine", "inventory", "exchange_request", "user"
  resourceId: Types.ObjectId;
  changes: IChanges;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  status: "success" | "failure";
  errorMessage?: string;
  hospital?: Types.ObjectId;
  branch?: Types.ObjectId;
  retentionUntil: Date; // When log can be deleted (7 years for healthcare)
  createdAt: Date;
}

/**
 * Changes Schema
 */
const changesSchema = new Schema<IChanges>(
  {
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

/**
 * Audit Log Schema
 * Immutable audit trail for compliance
 */
const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const user = await User.findById(v);
          return !!user;
        },
        message: "User not found",
      },
    },

    actorRole: {
      type: String,
      required: [true, "Actor role is required"],
      trim: true,
      description: "Snapshot of user role at time of action",
    },

    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "REJECT", "EXPORT"],
        message: "Invalid action",
      },
      uppercase: true,
      index: true,
    },

    resource: {
      type: String,
      required: [true, "Resource is required"],
      trim: true,
      lowercase: true,
      index: true,
      enum: [
        "medicine",
        "inventory",
        "exchange_request",
        "exchange_item",
        "user",
        "hospital",
        "branch",
        "role",
        "permission",
      ],
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      required: [true, "Resource ID is required"],
      index: true,
    },

    changes: {
      type: changesSchema,
      default: () => ({}),
      description: "Before/after state of the resource",
    },

    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
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

    sessionId: {
      type: String,
      trim: true,
      description: "Optional: link to login session",
    },

    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["success", "failure"],
        message: "Status must be success or failure",
      },
      lowercase: true,
      index: true,
    },

    errorMessage: {
      type: String,
      trim: true,
      maxlength: [500, "Error message must not exceed 500 characters"],
      validate: {
        validator: function (v?: string) {
          if (this.status === "failure") {
            return !!v;
          }
          return true;
        },
        message: "Error message required when status is failure",
      },
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
      validate: {
        validator: async function (v?: Types.ObjectId) {
          if (!v) return true;
          const hospital = await Hospital.findById(v);
          return !!hospital;
        },
        message: "Hospital not found",
      },
    },

    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
    },

    retentionUntil: {
      type: Date,
      required: [true, "Retention date is required"],
      index: true,
      description: "When log can be deleted (7 years for healthcare compliance)",
    },
  },
  {
    timestamps: false, // Only createdAt, no updatedAt for immutability
    strict: true,
  }
);

// Set createdAt manually to ensure it's set
auditLogSchema.pre("save", function (next) {
  if (!this.createdAt) {
    this.createdAt = new Date();
  }
  next();
});

/**
 * Indexes
 */
// Compound indexes for common audit queries
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ hospital: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1 });

// TTL index for retention policy (auto-delete after retentionUntil)
auditLogSchema.index(
  { retentionUntil: 1 },
  { expireAfterSeconds: 0 }
);

/**
 * Make collection immutable after insert
 */
auditLogSchema.pre("updateOne", function (next) {
  throw new Error("Audit logs are immutable");
});

auditLogSchema.pre("findOneAndUpdate", function (next) {
  throw new Error("Audit logs are immutable");
});

/**
 * Static method: Log user action
 */
auditLogSchema.statics.logAction = async function (data: {
  actor: Types.ObjectId;
  actorRole: string;
  action: string;
  resource: string;
  resourceId: Types.ObjectId;
  changes?: IChanges;
  ipAddress: string;
  userAgent: string;
  status: "success" | "failure";
  errorMessage?: string;
  hospital?: Types.ObjectId;
  branch?: Types.ObjectId;
}): Promise<IAuditLog> {
  const retentionDate = new Date();
  retentionDate.setFullYear(retentionDate.getFullYear() + 7); // 7 years

  return this.create({
    ...data,
    retentionUntil: retentionDate,
  });
};

/**
 * Static method: Get user activity history
 */
auditLogSchema.statics.getUserHistory = function (
  userId: Types.ObjectId,
  limit: number = 100
) {
  return this.find({ actor: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actor", "firstName lastName email")
    .populate("hospital", "name");
};

/**
 * Static method: Get resource change history
 */
auditLogSchema.statics.getResourceHistory = function (
  resource: string,
  resourceId: Types.ObjectId
) {
  return this.find({ resource, resourceId })
    .sort({ createdAt: -1 })
    .populate("actor", "firstName lastName")
    .populate("hospital", "name");
};

/**
 * Static method: Get hospital activity
 */
auditLogSchema.statics.getHospitalActivity = function (
  hospitalId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
  limit: number = 200
) {
  const query: any = { hospital: hospitalId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actor", "firstName lastName")
    .populate("hospital", "name");
};

/**
 * Static method: Get failed actions
 */
auditLogSchema.statics.getFailedActions = function (
  hospitalId?: Types.ObjectId,
  limit: number = 50
) {
  const query: any = { status: "failure" };
  if (hospitalId) query.hospital = hospitalId;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actor", "firstName lastName");
};

/**
 * Static method: Search audit logs
 */
auditLogSchema.statics.search = function (criteria: {
  action?: string;
  resource?: string;
  hospitalId?: Types.ObjectId;
  userId?: Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  status?: "success" | "failure";
  limit?: number;
}) {
  const query: any = {};

  if (criteria.action) query.action = criteria.action;
  if (criteria.resource) query.resource = criteria.resource;
  if (criteria.hospitalId) query.hospital = criteria.hospitalId;
  if (criteria.userId) query.actor = criteria.userId;
  if (criteria.status) query.status = criteria.status;

  if (criteria.startDate || criteria.endDate) {
    query.createdAt = {};
    if (criteria.startDate) query.createdAt.$gte = criteria.startDate;
    if (criteria.endDate) query.createdAt.$lte = criteria.endDate;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(criteria.limit || 100)
    .populate("actor", "firstName lastName email")
    .populate("hospital", "name");
};

/**
 * Static method: Generate compliance report
 */
auditLogSchema.statics.getComplianceReport = async function (
  hospitalId: Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        hospital: hospitalId,
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              totalActions: { $sum: 1 },
              successfulActions: {
                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
              },
              failedActions: {
                $sum: { $cond: [{ $eq: ["$status", "failure"] }, 1, 0] },
              },
            },
          },
        ],
        byAction: [
          {
            $group: {
              _id: "$action",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        byResource: [
          {
            $group: {
              _id: "$resource",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        byUser: [
          {
            $group: {
              _id: "$actor",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);
};

/**
 * Instance method: Get formatted description
 */
auditLogSchema.methods.getDescription = function (): string {
  const actions: Record<string, string> = {
    CREATE: "Created",
    READ: "Read",
    UPDATE: "Updated",
    DELETE: "Deleted",
    APPROVE: "Approved",
    REJECT: "Rejected",
    EXPORT: "Exported",
  };

  return `${actions[this.action] || "Modified"} ${this.resource}: ${this.resourceId}`;
};

/**
 * Audit Log Model
 */
export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);