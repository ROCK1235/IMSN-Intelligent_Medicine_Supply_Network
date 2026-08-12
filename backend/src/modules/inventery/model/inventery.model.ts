import { Schema, model, Document, Types } from "mongoose";
import { Hospital } from "../../hospitals/model/hospitals.model";
import { Branch } from "../../branches/model/branches.model";
import { Medicine } from "../../medicine/model/medicine.model";
import { generateSequentialId } from "../../counter/service/counter.service";

/**
 * Interface for Inventory
 * Track medicine stock at branch level
 */
export interface IInventory extends Document {
  _id: Types.ObjectId;
  inventoryId: string;
  hospital: Types.ObjectId; // Reference to hospitals
  branch: Types.ObjectId; // Reference to branches
  medicine: Types.ObjectId; // Reference to medicines
  quantityInStock: number;
  quantityReserved: number;
  quantityAvailable: number; // Calculated: quantityInStock - quantityReserved
  batchNumber: string;
  manufacturingDate: Date;
  expiryDate: Date;
  storageLocation: string;
  status: "active" | "expiring_soon" | "expired" | "obsolete";
  lastStockCheckDate?: Date;
  lastStockCheckQuantity?: number;
  cost: number; // Total cost: quantityInStock * unitCost
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inventory Schema
 * Track medicine stock at branch level
 */
const inventorySchema = new Schema<IInventory>(
  {
    inventoryId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
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
      required: [true, "Branch is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const branch = await Branch.findById(v);
          if (!branch) {
            throw new Error("Branch not found");
          }
          if (this.hospital && !branch.hospital.equals(this.hospital)) {
            throw new Error("Branch must belong to assigned hospital");
          }
          return true;
        },
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

    quantityInStock: {
      type: Number,
      required: [true, "Quantity in stock is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
      index: true,
    },

    quantityReserved: {
      type: Number,
      required: [true, "Reserved quantity is required"],
      min: [0, "Reserved quantity cannot be negative"],
      default: 0,
      validate: {
        validator: function (v: number) {
          return v <= this.quantityInStock;
        },
        message: "Reserved quantity cannot exceed stock quantity",
      },
    },

    quantityAvailable: {
      type: Number,
      required: [true, "Available quantity is required"],
      min: [0, "Available quantity cannot be negative"],
      default: 0,
      description: "Calculated field: quantityInStock - quantityReserved",
    },

    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
      minlength: [5, "Batch number must be at least 5 characters"],
      maxlength: [50, "Batch number must not exceed 50 characters"],
      validate: {
        validator: function (v: string) {
          return /^[A-Z0-9\-]+$/.test(v);
        },
        message: "Batch number must contain only uppercase letters, numbers, and hyphens",
      },
    },

    manufacturingDate: {
      type: Date,
      required: [true, "Manufacturing date is required"],
      validate: {
        validator: function (v: Date) {
          return v <= new Date();
        },
        message: "Manufacturing date must be in the past",
      },
    },

    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: true,
      validate: {
        validator: function (v: Date) {
          if (v <= this.manufacturingDate) {
            throw new Error("Expiry date must be after manufacturing date");
          }
          return true;
        },
      },
    },

    storageLocation: {
      type: String,
      trim: true,
      maxlength: [50, "Storage location must not exceed 50 characters"],
      description: 'e.g., "Shelf A3", "Freezer 2", "Cabinet 5B"',
    },

    status: {
      type: String,
      enum: {
        values: ["active", "expiring_soon", "expired", "obsolete"],
        message: "Invalid status",
      },
      default: "active",
      index: true,
    },

    lastStockCheckDate: Date,

    lastStockCheckQuantity: Number,

    cost: {
      type: Number,
      required: [true, "Cost is required"],
      min: [0, "Cost cannot be negative"],
      default: 0,
      description: "Total cost: quantityInStock * unitCost",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Unique compound index for inventory uniqueness. Includes batchNumber
// (decided in Phase 4 — see DESIGN.md §1.3) so a branch can hold several
// batches of the same medicine at once, each with its own expiry date —
// matches how pharmacies actually receive stock.
inventorySchema.index(
  { hospital: 1, branch: 1, medicine: 1, batchNumber: 1 },
  { unique: true }
);

// Indexes for expiry tracking
inventorySchema.index({ branch: 1, expiryDate: 1 });
inventorySchema.index({ medicine: 1, expiryDate: 1 });
inventorySchema.index({ expiryDate: 1 });

// Indexes for status queries
inventorySchema.index({ status: 1 });
inventorySchema.index({ branch: 1, status: 1 });

// Indexes for low stock alerts
inventorySchema.index({ quantityAvailable: 1 });

// Compound indexes for common queries
inventorySchema.index({ hospital: 1, status: 1 });
inventorySchema.index({ branch: 1, medicine: 1 });

/**
 * Pre-save hook: Auto-generate sequential inventory ID
 */
inventorySchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.inventoryId = await generateSequentialId("inventory", "INV");
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Pre-save hook: Calculate quantityAvailable and determine status
 */
inventorySchema.pre("save", function (next) {
  // Calculate available quantity
  this.quantityAvailable = Math.max(
    0,
    this.quantityInStock - this.quantityReserved
  );

  // Determine status based on expiry date
  const now = new Date();
  const daysToExpiry = Math.floor(
    (this.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (this.expiryDate <= now) {
    this.status = "expired";
  } else if (daysToExpiry <= 30) {
    this.status = "expiring_soon";
  } else {
    this.status = "active";
  }

  next();
});

/**
 * Static method: Find inventory for a hospital
 */
inventorySchema.statics.findByHospital = function (hospitalId: Types.ObjectId) {
  return this.find({ hospital: hospitalId }).populate("medicine");
};

/**
 * Static method: Find inventory for a branch
 */
inventorySchema.statics.findByBranch = function (branchId: Types.ObjectId) {
  return this.find({ branch: branchId }).populate("medicine");
};

/**
 * Static method: Find expiring medicines (within 30 days)
 */
inventorySchema.statics.findExpiringMedicines = function (days: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    expiryDate: {
      $gte: new Date(),
      $lte: futureDate,
    },
    status: { $ne: "expired" },
  }).populate("medicine");
};

/**
 * Static method: Find expired medicines
 */
inventorySchema.statics.findExpiredMedicines = function () {
  return this.find({
    expiryDate: { $lt: new Date() },
    status: "expired",
  }).populate("medicine");
};

/**
 * Static method: Find low stock items
 */
inventorySchema.statics.findLowStock = function () {
  return this.aggregate([
    {
      $lookup: {
        from: "medicines",
        localField: "medicine",
        foreignField: "_id",
        as: "medicineData",
      },
    },
    {
      $match: {
        $expr: { $lte: ["$quantityAvailable", { $arrayElemAt: ["$medicineData.reorderLevel", 0] }] },
      },
    },
  ]);
};

/**
 * Static method: Find inventory by medicine across all branches
 */
inventorySchema.statics.findByMedicine = function (medicineId: Types.ObjectId) {
  return this.find({ medicine: medicineId })
    .populate("branch")
    .populate("hospital");
};

/**
 * Static method: Find available stock of medicine in a hospital
 */
inventorySchema.statics.findAvailableStock = function (
  hospitalId: Types.ObjectId,
  medicineId: Types.ObjectId
) {
  return this.find({
    hospital: hospitalId,
    medicine: medicineId,
    status: { $ne: "expired" },
    expiryDate: { $gt: new Date() },
    quantityAvailable: { $gt: 0 },
  });
};

/**
 * Instance method: Get days until expiry
 */
inventorySchema.methods.getDaysToExpiry = function (): number {
  const now = new Date();
  return Math.floor(
    (this.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
};

/**
 * Instance method: Is expired
 */
inventorySchema.methods.isExpired = function (): boolean {
  return this.expiryDate <= new Date();
};

/**
 * Instance method: Is expiring soon (within 30 days)
 */
inventorySchema.methods.isExpiringSoon = function (days: number = 30): boolean {
  const daysToExpiry = this.getDaysToExpiry();
  return daysToExpiry > 0 && daysToExpiry <= days;
};

/**
 * Instance method: Can be used for exchange
 */
inventorySchema.methods.canBeUsedForExchange = function (): boolean {
  return (
    this.status !== "expired" &&
    !this.isExpiringSoon(15) &&
    this.quantityAvailable > 0
  );
};

/**
 * Instance method: Reserve quantity
 */
inventorySchema.methods.reserveQuantity = async function (
  quantity: number
): Promise<boolean> {
  if (quantity > this.quantityAvailable) {
    return false;
  }

  this.quantityReserved += quantity;
  this.quantityAvailable = Math.max(
    0,
    this.quantityInStock - this.quantityReserved
  );

  await this.save();
  return true;
};

/**
 * Instance method: Release reserved quantity
 */
inventorySchema.methods.releaseReservation = async function (
  quantity: number
): Promise<void> {
  this.quantityReserved = Math.max(0, this.quantityReserved - quantity);
  this.quantityAvailable = Math.max(
    0,
    this.quantityInStock - this.quantityReserved
  );
  await this.save();
};

/**
 * Inventory Model
 */
export const Inventory = model<IInventory>("Inventory", inventorySchema);