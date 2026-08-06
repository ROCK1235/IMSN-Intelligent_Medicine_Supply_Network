import { Schema, model, Document, Types } from "mongoose";
import { ExchangeRequest } from "../../exchangerequests/model/Exchangerequests.model";
import { Medicine } from "../../medicine/model/medicine.model";
import { Inventory } from "../../inventery/model/inventery.model";

/**
 * Interface for Exchange Items
 * Individual medicines in an exchange request
 */
export interface IExchangeItem extends Document {
  _id: Types.ObjectId;
  exchangeRequest: Types.ObjectId; // Reference to exchange_requests
  medicine: Types.ObjectId; // Reference to medicines
  inventory: Types.ObjectId; // Reference to specific inventory batch
  quantityRequested: number;
  quantityApproved?: number;
  quantityReceived?: number;
  expiryDate: Date;
  daysToExpiry: number; // Calculated field
  status: "pending" | "approved" | "rejected" | "delivered" | "received_partial";
  reason?: string; // For rejection
  batchNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exchange Item Schema
 * Individual medicines in an exchange request
 */
const exchangeItemSchema = new Schema<IExchangeItem>(
  {
    exchangeRequest: {
      type: Schema.Types.ObjectId,
      ref: "ExchangeRequest",
      required: [true, "Exchange request is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const request = await ExchangeRequest.findById(v);
          return !!request;
        },
        message: "Exchange request not found",
      },
    },

    medicine: {
      type: Schema.Types.ObjectId,
      ref: "Medicine",
      required: [true, "Medicine is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const medicine = await Medicine.findById(v);
          if (!medicine || !medicine.isActive) {
            throw new Error("Medicine must exist and be active");
          }
          return true;
        },
      },
    },

    inventory: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: [true, "Inventory is required"],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const inventory = await Inventory.findById(v);
          if (!inventory) {
            throw new Error("Inventory not found");
          }

          // Validate inventory belongs to recipient hospital (will be checked in service)
          return true;
        },
      },
    },

    quantityRequested: {
      type: Number,
      required: [true, "Quantity requested is required"],
      min: [1, "Quantity must be at least 1"],
      integer: true,
      index: true,
      validate: {
        validator: async function (v: number) {
          const inventory = await Inventory.findById(this.inventory);
          if (inventory && v > inventory.quantityAvailable) {
            throw new Error("Quantity exceeds available stock");
          }
          return true;
        },
      },
    },

    quantityApproved: {
      type: Number,
      min: [0, "Quantity approved cannot be negative"],
      integer: true,
      validate: {
        validator: function (v?: number) {
          if (!v) return true;
          return v <= this.quantityRequested;
        },
        message: "Quantity approved cannot exceed quantity requested",
      },
    },

    quantityReceived: {
      type: Number,
      min: [0, "Quantity received cannot be negative"],
      integer: true,
      validate: {
        validator: function (v?: number) {
          if (!v) return true;
          const approved = this.quantityApproved || this.quantityRequested;
          return v <= approved;
        },
        message: "Quantity received cannot exceed approved quantity",
      },
    },

    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
      validate: {
        validator: function (v: Date) {
          const now = new Date();
          return v > now;
        },
        message: "Medicine must not be expired",
      },
    },

    daysToExpiry: {
      type: Number,
      required: [true, "Days to expiry is required"],
      min: [15, "Medicine must have at least 15 days to expiry"],
      validate: {
        validator: function (v: number) {
          return v > 0;
        },
        message: "Days to expiry must be positive",
      },
    },

    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "delivered", "received_partial"],
        message: "Invalid status",
      },
      default: "pending",
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      minlength: [5, "Reason must be at least 5 characters"],
      maxlength: [500, "Reason must not exceed 500 characters"],
      validate: {
        validator: function (v?: string) {
          if (this.status === "rejected") {
            return !!v;
          }
          return true;
        },
        message: "Reason is required for rejected items",
      },
    },

    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
      minlength: [5, "Batch number must be at least 5 characters"],
      maxlength: [50, "Batch number must not exceed 50 characters"],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Compound indexes for common queries
exchangeItemSchema.index({ exchangeRequest: 1, medicine: 1 });
exchangeItemSchema.index({ medicine: 1, status: 1 });
exchangeItemSchema.index({ expiryDate: 1 });
exchangeItemSchema.index({ status: 1 });

// Compound index for finding items in exchange
exchangeItemSchema.index({ exchangeRequest: 1, status: 1 });

/**
 * Pre-save hook: Calculate days to expiry and validate exchange eligibility
 */
exchangeItemSchema.pre("save", async function (next) {
  // Calculate days to expiry
  const now = new Date();
  const daysToExpiry = Math.floor(
    (this.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  this.daysToExpiry = daysToExpiry;

  // Validate exchange eligibility
  if (daysToExpiry < 15) {
    throw new Error("Cannot exchange medicines with less than 15 days to expiry");
  }

  // Validate expired medicines
  if (this.expiryDate <= now) {
    throw new Error("Cannot exchange expired medicines");
  }

  next();
});

/**
 * Static method: Find all items in an exchange
 */
exchangeItemSchema.statics.findByExchange = function (
  exchangeRequestId: Types.ObjectId
) {
  return this.find({ exchangeRequest: exchangeRequestId })
    .populate("medicine", "name strength form genericName")
    .populate("inventory", "batchNumber expiryDate");
};

/**
 * Static method: Find items pending approval
 */
exchangeItemSchema.statics.findPendingApproval = function () {
  return this.find({ status: "pending" })
    .populate("exchangeRequest")
    .populate("medicine", "name strength");
};

/**
 * Static method: Find items for specific medicine across exchanges
 */
exchangeItemSchema.statics.findByMedicine = function (
  medicineId: Types.ObjectId,
  status?: string
) {
  const query: any = { medicine: medicineId };
  if (status) query.status = status;
  return this.find(query)
    .populate("exchangeRequest")
    .sort({ createdAt: -1 });
};

/**
 * Static method: Find expiring items (within 30 days)
 */
exchangeItemSchema.statics.findExpiringItems = function (days: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    expiryDate: {
      $gte: new Date(),
      $lte: futureDate,
    },
    status: { $ne: "rejected" },
  })
    .populate("medicine", "name strength")
    .populate("exchangeRequest", "initiatorHospital recipientHospital");
};

/**
 * Static method: Get exchange summary
 */
exchangeItemSchema.statics.getSummary = async function (
  exchangeRequestId: Types.ObjectId
) {
  return this.aggregate([
    { $match: { exchangeRequest: exchangeRequestId } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalRequested: { $sum: "$quantityRequested" },
        totalApproved: {
          $sum: { $cond: ["$quantityApproved", "$quantityApproved", 0] },
        },
        totalReceived: {
          $sum: { $cond: ["$quantityReceived", "$quantityReceived", 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        approved: {
          $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
        },
      },
    },
  ]);
};

/**
 * Instance method: Get days to expiry
 */
exchangeItemSchema.methods.getDaysToExpiry = function (): number {
  const now = new Date();
  return Math.floor(
    (this.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
};

/**
 * Instance method: Is expiring soon (within 30 days)
 */
exchangeItemSchema.methods.isExpiringSoon = function (days: number = 30): boolean {
  return this.daysToExpiry > 0 && this.daysToExpiry <= days;
};

/**
 * Instance method: Can be fulfilled
 */
exchangeItemSchema.methods.canBeFulfilled = function (): boolean {
  return (
    this.status === "approved" &&
    this.daysToExpiry >= 15 &&
    this.quantityApproved &&
    this.quantityApproved > 0
  );
};

/**
 * Instance method: Approve item
 */
exchangeItemSchema.methods.approve = async function (quantity?: number): Promise<void> {
  if (this.status !== "pending") {
    throw new Error("Only pending items can be approved");
  }

  const approveQty = quantity || this.quantityRequested;
  if (approveQty < 1 || approveQty > this.quantityRequested) {
    throw new Error("Approved quantity must be 1-requested amount");
  }

  this.status = "approved";
  this.quantityApproved = approveQty;
  await this.save();
};

/**
 * Instance method: Reject item
 */
exchangeItemSchema.methods.reject = async function (reason: string): Promise<void> {
  if (this.status !== "pending") {
    throw new Error("Only pending items can be rejected");
  }

  if (!reason || reason.length < 5) {
    throw new Error("Rejection reason required (min 5 characters)");
  }

  this.status = "rejected";
  this.reason = reason;
  await this.save();
};

/**
 * Instance method: Mark as delivered
 */
exchangeItemSchema.methods.markDelivered = async function (): Promise<void> {
  if (this.status !== "approved") {
    throw new Error("Only approved items can be marked delivered");
  }

  this.status = "delivered";
  await this.save();
};

/**
 * Exchange Item Model
 */
export const ExchangeItem = model<IExchangeItem>(
  "ExchangeItem",
  exchangeItemSchema
);