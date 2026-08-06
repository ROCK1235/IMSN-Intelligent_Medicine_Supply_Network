import { Schema, model, Document, Types } from "mongoose";
import { Hospital } from "../../hospitals/model/hospitals.model";
import { User } from "../../user/model/User.model";

/**
 * Status history item interface
 */
export interface IStatusHistory {
  status: string;
  changedAt: Date;
  changedBy: Types.ObjectId;
  reason?: string;
}

/**
 * Interface for Exchange Requests
 * Manage medicine exchange requests between hospitals
 */
export interface IExchangeRequest extends Document {
  _id: Types.ObjectId;
  requestNumber: string; // Unique: "ER-HOSP-2024-001"
  initiatorHospital: Types.ObjectId; // Hospital requesting medicine
  initiatorBranch: Types.ObjectId;
  recipientHospital: Types.ObjectId; // Hospital providing medicine
  recipientBranch: Types.ObjectId;
  createdBy: Types.ObjectId; // User initiating exchange
  approvedBy?: Types.ObjectId; // User approving exchange
  status:
    | "draft"
    | "pending"
    | "approved"
    | "rejected"
    | "in_transit"
    | "completed"
    | "cancelled";
  statusHistory: IStatusHistory[];
  requestDate: Date;
  requiredByDate: Date;
  approvalDate?: Date;
  rejectionDate?: Date;
  completionDate?: Date;
  totalItems: number; // Denormalized count
  totalQuantity: number; // Denormalized quantity
  rejectionReason?: string;
  cancelledByUser?: Types.ObjectId;
  cancellationReason?: string;
  notes?: string;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Status History Schema
 */
const statusHistorySchema = new Schema<IStatusHistory>(
  {
    status: {
      type: String,
      required: true,
      enum: ["draft", "pending", "approved", "rejected", "in_transit", "completed", "cancelled"],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: String,
  },
  { _id: false }
);

/**
 * Exchange Request Schema
 * Manage medicine exchange requests between hospitals
 */
const exchangeRequestSchema = new Schema<IExchangeRequest>(
  {
    requestNumber: {
      type: String,
      required: [true, "Request number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      validate: {
        validator: function (v: string) {
          return /^ER-[A-Z0-9\-]+$/.test(v);
        },
        message: "Invalid request number format",
      },
    },

    initiatorHospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Initiator hospital is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const hospital = await Hospital.findById(v);
          if (!hospital || !hospital.isActive || !hospital.isVerified) {
            throw new Error("Initiator hospital must exist, be active, and verified");
          }
          return true;
        },
      },
    },

    initiatorBranch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Initiator branch is required"],
    },

    recipientHospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Recipient hospital is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const hospital = await Hospital.findById(v);
          if (!hospital || !hospital.isActive || !hospital.isVerified) {
            throw new Error("Recipient hospital must exist, be active, and verified");
          }

          // Prevent self-exchange
          if (v.equals(this.initiatorHospital)) {
            throw new Error("Cannot exchange with same hospital");
          }

          return true;
        },
      },
    },

    recipientBranch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Recipient branch is required"],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const user = await User.findById(v);
          return !!user;
        },
        message: "User not found",
      },
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: {
        values: ["draft", "pending", "approved", "rejected", "in_transit", "completed", "cancelled"],
        message: "Invalid status",
      },
      default: "draft",
      index: true,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },

    requestDate: {
      type: Date,
      default: Date.now,
    },

    requiredByDate: {
      type: Date,
      required: [true, "Required by date is required"],
      validate: {
        validator: function (v: Date) {
          return v > new Date();
        },
        message: "Required by date must be in the future",
      },
    },

    approvalDate: Date,

    rejectionDate: Date,

    completionDate: Date,

    totalItems: {
      type: Number,
      default: 0,
      description: "Denormalized: count of exchange items",
    },

    totalQuantity: {
      type: Number,
      default: 0,
      description: "Denormalized: total quantity requested",
    },

    rejectionReason: {
      type: String,
      trim: true,
      minlength: [10, "Rejection reason must be at least 10 characters"],
      maxlength: [500, "Rejection reason must not exceed 500 characters"],
      validate: {
        validator: function (v?: string) {
          if (this.status === "rejected") {
            return !!v;
          }
          return true;
        },
        message: "Rejection reason is required when status is rejected",
      },
    },

    cancelledByUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Cancellation reason must not exceed 500 characters"],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes must not exceed 500 characters"],
      description: "Public notes visible to both hospitals",
    },

    internalNotes: {
      type: String,
      trim: true,
      maxlength: [500, "Internal notes must not exceed 500 characters"],
      description: "Admin/system notes",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Unique index on request number
exchangeRequestSchema.index({ requestNumber: 1 }, { unique: true });

// Indexes for common queries
exchangeRequestSchema.index({ initiatorHospital: 1, status: 1 });
exchangeRequestSchema.index({ recipientHospital: 1, status: 1 });
exchangeRequestSchema.index({ status: 1, requestDate: -1 });
exchangeRequestSchema.index({ createdBy: 1 });
exchangeRequestSchema.index({ approvalDate: 1 });

// Compound indexes
exchangeRequestSchema.index({ initiatorHospital: 1, status: 1, createdAt: -1 });
exchangeRequestSchema.index({ recipientHospital: 1, status: 1, createdAt: -1 });

/**
 * Pre-save hook: Record status changes
 */
exchangeRequestSchema.pre("save", async function (next) {
  // If status changed, record in history
  if (this.isModified("status") && this.createdBy) {
    const statusEntry: IStatusHistory = {
      status: this.status,
      changedAt: new Date(),
      changedBy: this.createdBy, // Will be overridden by caller if needed
      reason: this.rejectionReason || this.cancellationReason,
    };

    this.statusHistory.push(statusEntry);

    // Set related dates based on status
    switch (this.status) {
      case "approved":
        this.approvalDate = new Date();
        break;
      case "rejected":
        this.rejectionDate = new Date();
        break;
      case "completed":
        this.completionDate = new Date();
        break;
    }
  }

  next();
});

/**
 * Static method: Generate request number
 */
exchangeRequestSchema.statics.generateRequestNumber = async function (
  hospitalId: Types.ObjectId
): Promise<string> {
  const today = new Date().toISOString().slice(0, 4);
  const count = await this.countDocuments({
    initiatorHospital: hospitalId,
    createdAt: {
      $gte: new Date(`${today}-01-01`),
      $lte: new Date(`${today}-12-31`),
    },
  });
  
  return `ER-${hospitalId}-${today}-${String(count + 1).padStart(4, "0")}`;
};

/**
 * Static method: Find requests sent by hospital
 */
exchangeRequestSchema.statics.findSentByHospital = function (
  hospitalId: Types.ObjectId,
  status?: string
) {
  const query: any = { initiatorHospital: hospitalId };
  if (status) query.status = status;
  return this.find(query)
    .sort({ requestDate: -1 })
    .populate("initiatorHospital", "name")
    .populate("recipientHospital", "name")
    .populate("createdBy", "firstName lastName");
};

/**
 * Static method: Find requests received by hospital
 */
exchangeRequestSchema.statics.findReceivedByHospital = function (
  hospitalId: Types.ObjectId,
  status?: string
) {
  const query: any = { recipientHospital: hospitalId };
  if (status) query.status = status;
  return this.find(query)
    .sort({ requestDate: -1 })
    .populate("initiatorHospital", "name")
    .populate("recipientHospital", "name")
    .populate("createdBy", "firstName lastName");
};

/**
 * Static method: Find pending approvals
 */
exchangeRequestSchema.statics.findPendingApprovals = function (
  hospitalId: Types.ObjectId
) {
  return this.find({
    recipientHospital: hospitalId,
    status: "pending",
  })
    .sort({ requestDate: 1 })
    .populate("initiatorHospital", "name")
    .populate("createdBy", "firstName lastName");
};

/**
 * Static method: Find overdue exchanges (required date passed)
 */
exchangeRequestSchema.statics.findOverdue = function () {
  return this.find({
    status: { $in: ["pending", "approved", "in_transit"] },
    requiredByDate: { $lt: new Date() },
  }).populate("initiatorHospital", "name");
};

/**
 * Instance method: Can be approved by hospital
 */
exchangeRequestSchema.methods.canBeApprovedBy = function (
  hospitalId: Types.ObjectId
): boolean {
  return (
    this.recipientHospital.equals(hospitalId) &&
    this.status === "pending"
  );
};

/**
 * Instance method: Can be cancelled by user
 */
exchangeRequestSchema.methods.canBeCancelledBy = function (
  userId: Types.ObjectId
): boolean {
  return (
    (this.createdBy.equals(userId) && 
      ["draft", "pending"].includes(this.status)) ||
    this.status === "draft"
  );
};

/**
 * Instance method: Mark as approved
 */
exchangeRequestSchema.methods.markApproved = async function (
  userId: Types.ObjectId
): Promise<void> {
  if (!this.canBeApprovedBy(this.recipientHospital)) {
    throw new Error("Cannot approve this exchange request");
  }

  this.status = "approved";
  this.approvedBy = userId;
  this.approvalDate = new Date();

  const statusEntry: IStatusHistory = {
    status: "approved",
    changedAt: new Date(),
    changedBy: userId,
  };
  this.statusHistory.push(statusEntry);

  await this.save();
};

/**
 * Instance method: Mark as rejected
 */
exchangeRequestSchema.methods.markRejected = async function (
  userId: Types.ObjectId,
  reason: string
): Promise<void> {
  if (!this.canBeApprovedBy(this.recipientHospital)) {
    throw new Error("Cannot reject this exchange request");
  }

  this.status = "rejected";
  this.rejectionReason = reason;
  this.rejectionDate = new Date();

  const statusEntry: IStatusHistory = {
    status: "rejected",
    changedAt: new Date(),
    changedBy: userId,
    reason,
  };
  this.statusHistory.push(statusEntry);

  await this.save();
};

/**
 * Instance method: Get status history
 */
exchangeRequestSchema.methods.getStatusTimeline = function (): IStatusHistory[] {
  return this.statusHistory.sort((a, b) => 
    a.changedAt.getTime() - b.changedAt.getTime()
  );
};

/**
 * Exchange Request Model
 */
export const ExchangeRequest = model<IExchangeRequest>(
  "ExchangeRequest",
  exchangeRequestSchema
);