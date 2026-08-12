import { Schema, model, Document, Types } from "mongoose";
import { Hospital } from "../../hospitals/model/hospitals.model";
import { User } from "../../user/model/User.model";
import { generateSequentialId } from "../../counter/service/counter.service";

/**
 * Interface for Inventory Transactions
 * Audit trail for all inventory changes (immutable)
 */
export interface IInventoryTransaction extends Document {
  _id: Types.ObjectId;
  transactionId: string;
  transactionType:
    | "stock_in"
    | "stock_out"
    | "adjustment"
    | "exchange_sent"
    | "exchange_received"
    | "expired_disposal";
  referenceType?: string;
  referenceId?: Types.ObjectId;
  hospital: Types.ObjectId;
  branch?: Types.ObjectId;
  medicine: Types.ObjectId;
  inventory?: Types.ObjectId;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  notes?: string;
  performedBy: Types.ObjectId;
  cost?: number;
  createdAt: Date;
}

/**
 * Inventory Transaction Schema
 * Immutable audit trail for inventory changes
 */
const inventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    transactionType: {
      type: String,
      required: [true, "Transaction type is required"],
      enum: {
        values: [
          "stock_in",
          "stock_out",
          "adjustment",
          "exchange_sent",
          "exchange_received",
          "expired_disposal",
        ],
        message: "Invalid transaction type",
      },
      index: true,
    },

    referenceType: {
      type: String,
      enum: ["purchase_order", "exchange_request", "manual_adjustment", "auto_disposal"],
      trim: true,
    },

    referenceId: {
      type: Schema.Types.ObjectId,
      description: "Link to related document (exchange request, purchase order, etc.)",
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Hospital is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
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

    medicine: {
      type: Schema.Types.ObjectId,
      ref: "Medicine",
      required: [true, "Medicine is required"],
      index: true,
    },

    inventory: {
      type: Schema.Types.ObjectId,
      ref: "Inventory",
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      description: "Quantity changed (positive or negative)",
    },

    quantityBefore: {
      type: Number,
      required: [true, "Quantity before is required"],
      min: [0, "Quantity before cannot be negative"],
    },

    quantityAfter: {
      type: Number,
      required: [true, "Quantity after is required"],
      min: [0, "Quantity after cannot be negative"],
      validate: {
        validator: function (v: number) {
          return Math.abs((v - this.quantityBefore) - this.quantity) < 0.01;
        },
        message: "Quantity after must equal quantity before + quantity changed",
      },
    },

    reason: {
      type: String,
      trim: true,
      minlength: [5, "Reason must be at least 5 characters"],
      maxlength: [500, "Reason must not exceed 500 characters"],
      validate: {
        validator: function (v?: string) {
          // Reason required for certain transaction types
          if (
            [
              "stock_out",
              "adjustment",
              "exchange_sent",
              "expired_disposal",
            ].includes(this.transactionType)
          ) {
            return !!v;
          }
          return true;
        },
        message: "Reason is required for this transaction type",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes must not exceed 500 characters"],
    },

    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Performed by user is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const user = await User.findById(v);
          return !!user;
        },
        message: "User not found",
      },
    },

    cost: {
      type: Number,
      min: [0, "Cost cannot be negative"],
      description: "Transaction cost (if applicable)",
    },
  },
  {
    timestamps: false, // Only createdAt, no updatedAt for immutability
    strict: true,
  }
);

/**
 * Pre-save hook: Auto-generate sequential transaction ID
 */
inventoryTransactionSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.transactionId = await generateSequentialId("inventory_transaction", "TXN");
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Set createdAt manually
inventoryTransactionSchema.pre("save", function (next) {
  if (!this.createdAt) {
    this.createdAt = new Date();
  }
  next();
});

/**
 * Indexes
 */
// Indexes for common queries
inventoryTransactionSchema.index({ hospital: 1, createdAt: -1 });
inventoryTransactionSchema.index({ medicine: 1, transactionType: 1 });
inventoryTransactionSchema.index({ referenceId: 1 });
inventoryTransactionSchema.index({ transactionType: 1 });
inventoryTransactionSchema.index({ createdAt: -1 });

// Compound indexes
inventoryTransactionSchema.index({ inventory: 1, createdAt: -1 });
inventoryTransactionSchema.index({ performedBy: 1, createdAt: -1 });

/**
 * Make collection immutable after insert
 */
inventoryTransactionSchema.pre("updateOne", function (next) {
  throw new Error("Inventory transactions are immutable");
});

// Use 'findOneAndUpdate' instead of 'findByIdAndUpdate' to match Mongoose middleware hooks
inventoryTransactionSchema.pre("findOneAndUpdate", function (next) {
  throw new Error("Inventory transactions are immutable");
});

/**
 * Static method: Get transaction history for inventory
 */
inventoryTransactionSchema.statics.getInventoryHistory = function (
  inventoryId: Types.ObjectId,
  limit: number = 50
) {
  return this.find({ inventory: inventoryId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("performedBy", "firstName lastName email")
    .populate("medicine", "name strength form");
};

/**
 * Static method: Get transaction history for hospital
 */
inventoryTransactionSchema.statics.getHospitalHistory = function (
  hospitalId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
  limit: number = 100
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
    .populate("performedBy", "firstName lastName")
    .populate("medicine", "name strength");
};

/**
 * Static method: Get transactions by user
 */
inventoryTransactionSchema.statics.getByUser = function (
  userId: Types.ObjectId,
  limit: number = 50
) {
  return this.find({ performedBy: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("medicine", "name strength")
    .populate("hospital", "name");
};

/**
 * Static method: Get transactions by type
 */
inventoryTransactionSchema.statics.getByType = function (
  transactionType: string,
  limit: number = 50
) {
  return this.find({ transactionType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("medicine", "name strength")
    .populate("hospital", "name");
};

/**
 * Static method: Get exchanges via transactions
 */
inventoryTransactionSchema.statics.getExchangeTransactions = function (
  referenceId: Types.ObjectId
) {
  return this.find({
    $or: [
      { referenceId, transactionType: "exchange_sent" },
      { referenceId, transactionType: "exchange_received" },
    ],
  })
    .sort({ createdAt: -1 })
    .populate("medicine", "name strength")
    .populate("performedBy", "firstName lastName");
};

/**
 * Static method: Calculate total transactions for a period
 */
inventoryTransactionSchema.statics.getSummary = async function (
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
      $group: {
        _id: "$transactionType",
        count: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
        totalCost: { $sum: { $cond: ["$cost", "$cost", 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Static method: Validate stock consistency
 */
inventoryTransactionSchema.statics.validateStockConsistency = async function (
  inventoryId: Types.ObjectId
) {
  const transactions = await this.find({ inventory: inventoryId })
    .sort({ createdAt: 1 });

  if (transactions.length === 0) return true;

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const expectedQty = i === 0 
      ? transaction.quantityBefore + transaction.quantity 
      : transactions[i - 1].quantityAfter + transaction.quantity;

    if (Math.abs(transaction.quantityAfter - expectedQty) > 0.01) {
      console.error(`Inconsistency at transaction ${transaction._id}`);
      return false;
    }
  }

  return true;
};

/**
 * Instance method: Get formatted description
 */
inventoryTransactionSchema.methods.getDescription = function (): string {
  const descriptions: Record<string, string> = {
    stock_in: "Stock received",
    stock_out: "Stock removed",
    adjustment: "Inventory adjustment",
    exchange_sent: "Sent via exchange",
    exchange_received: "Received via exchange",
    expired_disposal: "Disposal - expired",
  };

  return descriptions[this.transactionType] || "Unknown transaction";
};

/**
 * Inventory Transaction Model
 */
export const InventoryTransaction = model<IInventoryTransaction>(
  "InventoryTransaction",
  inventoryTransactionSchema
);