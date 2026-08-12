import { Schema, model, Document, Types } from "mongoose";
import { Hospital } from "../../hospitals/model/hospitals.model";
import { Branch } from "../../branches/model/branches.model";
import { User } from "../../user/model/User.model";
import { generateSequentialId } from "../../counter/service/counter.service";

export const EXCHANGE_REQUEST_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "in_transit",
  "completed",
  "cancelled",
] as const;

export type ExchangeRequestStatus = (typeof EXCHANGE_REQUEST_STATUSES)[number];

/**
 * Embedded status-change audit trail entry
 */
export interface IExchangeStatusHistoryEntry {
  status: ExchangeRequestStatus;
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
  requestNumber: string;

  initiatorHospital: Types.ObjectId;
  initiatorBranch: Types.ObjectId;
  recipientHospital: Types.ObjectId;
  recipientBranch: Types.ObjectId;

  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;

  status: ExchangeRequestStatus;
  statusHistory: IExchangeStatusHistoryEntry[];

  requestDate: Date;
  requiredByDate: Date;
  approvalDate?: Date;
  rejectionDate?: Date;
  completionDate?: Date;

  totalItems: number; // Denormalized count of ExchangeItem docs
  totalQuantity: number; // Denormalized sum of quantityRequested

  rejectionReason?: string;
  cancelledByUser?: Types.ObjectId;
  cancellationReason?: string;

  notes?: string;
  internalNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const statusHistoryEntrySchema = new Schema<IExchangeStatusHistoryEntry>(
  {
    status: {
      type: String,
      enum: EXCHANGE_REQUEST_STATUSES,
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

/**
 * Exchange Request Schema
 * Manage medicine exchange requests between hospitals
 */
const exchangeRequestSchema = new Schema<IExchangeRequest>(
  {
    // NOTE: design doc's illustrative format is "ER-HOSP-2024-001"; this project's
    // convention (see ARCHITECTURE.md §5) is a flat sequential id via
    // generateSequentialId, so requestNumber is "EXR-000001" instead.
    requestNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    initiatorHospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Initiator hospital is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const hospital = await Hospital.findById(v);
          if (!hospital || !hospital.isActive) {
            throw new Error("Initiator hospital must exist and be active");
          }
          return true;
        },
      },
    },

    initiatorBranch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Initiator branch is required"],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const branch = await Branch.findById(v);
          if (!branch) throw new Error("Initiator branch not found");
          if (this.initiatorHospital && !branch.hospital.equals(this.initiatorHospital)) {
            throw new Error("Initiator branch must belong to initiator hospital");
          }
          return true;
        },
      },
    },

    recipientHospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Recipient hospital is required"],
      index: true,
      validate: [
        {
          validator: async function (v: Types.ObjectId) {
            const hospital = await Hospital.findById(v);
            if (!hospital || !hospital.isActive) {
              throw new Error("Recipient hospital must exist and be active");
            }
            return true;
          },
        },
        {
          validator: function (v: Types.ObjectId) {
            return !this.initiatorHospital || !v.equals(this.initiatorHospital);
          },
          message: "Recipient hospital must differ from initiator hospital",
        },
      ],
    },

    recipientBranch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Recipient branch is required"],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const branch = await Branch.findById(v);
          if (!branch) throw new Error("Recipient branch not found");
          if (this.recipientHospital && !branch.hospital.equals(this.recipientHospital)) {
            throw new Error("Recipient branch must belong to recipient hospital");
          }
          return true;
        },
      },
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creating user is required"],
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
        values: EXCHANGE_REQUEST_STATUSES,
        message: "Invalid exchange request status",
      },
      default: "pending",
      index: true,
    },

    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: [],
    },

    requestDate: {
      type: Date,
      default: Date.now,
    },

    requiredByDate: {
      type: Date,
      required: [true, "Required-by date is required"],
      validate: {
        validator: function (v: Date) {
          return v > new Date();
        },
        message: "Required-by date must be in the future",
      },
    },

    approvalDate: Date,
    rejectionDate: Date,
    completionDate: Date,

    totalItems: {
      type: Number,
      default: 0,
      min: [0, "Total items cannot be negative"],
    },

    totalQuantity: {
      type: Number,
      default: 0,
      min: [0, "Total quantity cannot be negative"],
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason must not exceed 500 characters"],
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
      maxlength: [1000, "Notes must not exceed 1000 characters"],
    },

    internalNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Internal notes must not exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
exchangeRequestSchema.index({ initiatorHospital: 1, status: 1 });
exchangeRequestSchema.index({ recipientHospital: 1, status: 1 });
exchangeRequestSchema.index({ status: 1, requestDate: -1 });
exchangeRequestSchema.index({ createdBy: 1 });
exchangeRequestSchema.index({ approvalDate: 1 });

/**
 * Pre-save hook: Auto-generate sequential request number
 */
exchangeRequestSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.requestNumber = await generateSequentialId("exchange_request", "EXR");
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Static method: Requests sent by a hospital
 */
exchangeRequestSchema.statics.findByInitiator = function (hospitalId: Types.ObjectId) {
  return this.find({ initiatorHospital: hospitalId }).sort({ requestDate: -1 });
};

/**
 * Static method: Requests received by a hospital
 */
exchangeRequestSchema.statics.findByRecipient = function (hospitalId: Types.ObjectId) {
  return this.find({ recipientHospital: hospitalId }).sort({ requestDate: -1 });
};

/**
 * Instance method: Is still editable/cancellable by the requester
 */
exchangeRequestSchema.methods.isCancellable = function (): boolean {
  return this.status === "pending" || this.status === "approved";
};

/**
 * Exchange Request Model
 */
export const ExchangeRequest = model<IExchangeRequest>(
  "ExchangeRequest",
  exchangeRequestSchema
);
