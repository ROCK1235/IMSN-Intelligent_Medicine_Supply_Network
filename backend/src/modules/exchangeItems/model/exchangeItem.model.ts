import { Schema, model, Document, Types } from "mongoose";
import { ExchangeRequest } from "../../exchangeRequests/model/exchangeRequest.model";
import { Medicine } from "../../medicine/model/medicine.model";
import { Inventory } from "../../inventery/model/inventery.model";

export const EXCHANGE_ITEM_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "delivered",
  "received_partial",
  "received",
] as const;

export type ExchangeItemStatus = (typeof EXCHANGE_ITEM_STATUSES)[number];

/**
 * Interface for Exchange Items
 * Individual medicines within an exchange request
 */
export interface IExchangeItem extends Document {
  _id: Types.ObjectId;
  exchangeRequest: Types.ObjectId;
  medicine: Types.ObjectId;
  inventory: Types.ObjectId;

  quantityRequested: number;
  quantityApproved?: number;
  quantityReceived?: number;

  expiryDate: Date;
  daysToExpiry: number;

  status: ExchangeItemStatus;
  reason?: string;

  batchNumber: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Exchange Item Schema
 * Individual medicines within an exchange request
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
          return !!medicine;
        },
        message: "Medicine not found",
      },
    },

    inventory: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
      required: [true, "Source inventory batch is required"],
      validate: {
        validator: async function (v: Types.ObjectId) {
          const inventory = await Inventory.findById(v);
          return !!inventory;
        },
        message: "Inventory batch not found",
      },
    },

    quantityRequested: {
      type: Number,
      required: [true, "Requested quantity is required"],
      min: [1, "Requested quantity must be at least 1"],
    },

    quantityApproved: {
      type: Number,
      min: [0, "Approved quantity cannot be negative"],
      validate: {
        validator: function (v?: number) {
          if (v === undefined || v === null) return true;
          return v <= this.quantityRequested;
        },
        message: "Approved quantity cannot exceed requested quantity",
      },
    },

    quantityReceived: {
      type: Number,
      min: [0, "Received quantity cannot be negative"],
      validate: {
        validator: function (v?: number) {
          if (v === undefined || v === null) return true;
          const cap = this.quantityApproved ?? this.quantityRequested;
          return v <= cap;
        },
        message: "Received quantity cannot exceed approved quantity",
      },
    },

    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
    },

    daysToExpiry: {
      type: Number,
      description: "Calculated field for quick filtering — recomputed on every save",
    },

    status: {
      type: String,
      enum: {
        values: EXCHANGE_ITEM_STATUSES,
        message: "Invalid exchange item status",
      },
      default: "pending",
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason must not exceed 500 characters"],
      validate: {
        validator: function (v?: string) {
          if (this.status === "rejected") return !!v;
          return true;
        },
        message: "Reason is required when rejecting an item",
      },
    },

    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
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
exchangeItemSchema.index({ exchangeRequest: 1, medicine: 1 });
exchangeItemSchema.index({ medicine: 1, status: 1 });
exchangeItemSchema.index({ expiryDate: 1 });
exchangeItemSchema.index({ status: 1 });

/**
 * Pre-save hook: Recalculate daysToExpiry
 */
exchangeItemSchema.pre("save", function (next) {
  const now = new Date();
  this.daysToExpiry = Math.floor(
    (this.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  next();
});

/**
 * Static method: All items for an exchange request
 */
exchangeItemSchema.statics.findByRequest = function (requestId: Types.ObjectId) {
  return this.find({ exchangeRequest: requestId });
};

/**
 * Exchange Item Model
 */
export const ExchangeItem = model<IExchangeItem>("ExchangeItem", exchangeItemSchema);
