import { Schema, model, Document, Types } from "mongoose";
import { MedicineCategory } from "../../medicineCategories/model/medicineCategories.model";
import { Manufacturer } from "../../manufacturers/model/manufacturers.model";

/**
 * Interface for Medicines
 * Store medicine master data
 */
export interface IMedicine extends Document {
  _id: Types.ObjectId;
  name: string;
  genericName: string;
  hsn_sac: string;
  gst_rate: number;
  category: Types.ObjectId; // Reference to medicine_categories
  manufacturer: Types.ObjectId; // Reference to manufacturers
  strength: string; // e.g., "500mg", "10ml"
  form: string; // e.g., "tablet", "injection", "syrup"
  batchNumber?: string;
  registrationNumber: string;
  isScheduled: boolean;
  scheduleType?: string; // H, X, L, A, C, D, E, F, G, N
  reorderLevel: number;
  maxStockLevel: number;
  unitOfMeasure: string;
  shelfLife: number; // In days
  storageTemperature: string; // e.g., "2-8°C", "15-25°C"
  storageConditions: string[]; // e.g., ["protect_from_light", "keep_dry"]
  unitCost: number;
  sellingPrice: number;
  isActive: boolean;
  discontinuedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Medicine Schema
 * Store medicine master data
 */
const medicineSchema = new Schema<IMedicine>(
  {
    name: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true,
      minlength: [2, "Medicine name must be at least 2 characters"],
      maxlength: [100, "Medicine name must not exceed 100 characters"],
      index: true,
    },

    genericName: {
      type: String,
      required: [true, "Generic name is required"],
      trim: true,
      minlength: [2, "Generic name must be at least 2 characters"],
      maxlength: [100, "Generic name must not exceed 100 characters"],
    },

    hsn_sac: {
      type: String,
      required: [true, "HSN/SAC code is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{8}[A-Z0-9]{0,2}$/.test(v);
        },
        message: "Invalid HSN/SAC code format",
      },
    },

    gst_rate: {
      type: Number,
      required: [true, "GST rate is required"],
      enum: {
        values: [0, 5, 12, 18, 28],
        message: "GST rate must be 0, 5, 12, 18, or 28",
      },
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: "MedicineCategory",
      required: [true, "Category is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const category = await MedicineCategory.findById(v);
          if (!category || !category.isActive) {
            throw new Error("Category must exist and be active");
          }
          return true;
        },
      },
    },

    manufacturer: {
      type: Schema.Types.ObjectId,
      ref: "Manufacturer",
      required: [true, "Manufacturer is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const manufacturer = await Manufacturer.findById(v);
          if (!manufacturer || !manufacturer.isActive) {
            throw new Error("Manufacturer must exist and be active");
          }
          return true;
        },
      },
    },

    strength: {
      type: String,
      required: [true, "Strength is required"],
      trim: true,
      minlength: [2, "Strength must be at least 2 characters"],
      maxlength: [20, "Strength must not exceed 20 characters"],
      validate: {
        validator: function (v: string) {
          return /^[\d\.]+\s*(mg|mcg|g|ml|%|iu|mmol|meq)?$/.test(v);
        },
        message: "Invalid strength format. Use: 500mg, 10ml, 5%, etc.",
      },
    },

    form: {
      type: String,
      required: [true, "Form is required"],
      enum: [
        "tablet",
        "capsule",
        "injection",
        "syrup",
        "suspension",
        "ointment",
        "lotion",
        "cream",
        "powder",
        "solution",
        "inhaler",
        "patch",
        "drops",
        "spray",
      ],
      lowercase: true,
    },

    batchNumber: {
      type: String,
      trim: true,
      maxlength: [50, "Batch number must not exceed 50 characters"],
    },

    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      unique: true,
      trim: true,
      minlength: [5, "Registration number must be at least 5 characters"],
      maxlength: [20, "Registration number must not exceed 20 characters"],
      index: true,
      validate: {
        validator: function (v: string) {
          return /^[A-Z0-9\-:]+$/.test(v);
        },
        message: "Invalid registration number format",
      },
    },

    isScheduled: {
      type: Boolean,
      default: false,
    },

    scheduleType: {
      type: String,
      enum: ["H", "X", "L", "A", "C", "D", "E", "F", "G", "N"],
      validate: {
        validator: function (v?: string) {
          if (!v && !this.isScheduled) return true;
          return this.isScheduled ? !!v : true;
        },
        message: "Schedule type is required for scheduled drugs",
      },
    },

    reorderLevel: {
      type: Number,
      required: [true, "Reorder level is required"],
      min: [0, "Reorder level must be non-negative"],
      index: true,
    },

    maxStockLevel: {
      type: Number,
      required: [true, "Max stock level is required"],
      min: [0, "Max stock level must be positive"],
      validate: {
        validator: function (v: number) {
          return v > this.reorderLevel;
        },
        message: "Max stock level must exceed reorder level",
      },
    },

    unitOfMeasure: {
      type: String,
      required: [true, "Unit of measure is required"],
      enum: ["tablet", "capsule", "ml", "gm", "unit", "vial", "ampule", "strips"],
      lowercase: true,
    },

    shelfLife: {
      type: Number,
      required: [true, "Shelf life is required"],
      min: [1, "Shelf life must be at least 1 day"],
      max: [3650, "Shelf life cannot exceed 3650 days (10 years)"],
      description: "In days",
    },

    storageTemperature: {
      type: String,
      required: [true, "Storage temperature is required"],
      enum: ["2-8°C", "15-25°C", "room_temperature", "below_25°C"],
    },

    storageConditions: {
      type: [String],
      default: [],
      enum: [
        "protect_from_light",
        "keep_dry",
        "protect_from_moisture",
        "away_from_heat",
        "protect_from_air",
      ],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 5;
        },
        message: "Maximum 5 storage conditions allowed",
      },
    },

    unitCost: {
      type: Number,
      required: [true, "Unit cost is required"],
      min: [0.01, "Unit cost must be greater than 0"],
      set: (v: number) => parseFloat(v.toFixed(2)),
    },

    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      set: (v: number) => parseFloat(v.toFixed(2)),
      validate: {
        validator: function (v: number) {
          return v >= this.unitCost;
        },
        message: "Selling price must be >= unit cost",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    discontinuedDate: {
      type: Date,
      validate: {
        validator: function (v?: Date) {
          if (!v) return true;
          return v <= new Date();
        },
        message: "Discontinued date must be in the past",
      },
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Unique indexes
medicineSchema.index({ registrationNumber: 1 }, { unique: true });

// Compound unique index for same medicine from different manufacturers
medicineSchema.index({ name: 1, manufacturer: 1 });

// Indexes for common queries
medicineSchema.index({ category: 1 });
medicineSchema.index({ manufacturer: 1 });
medicineSchema.index({ isActive: 1 });
medicineSchema.index({ reorderLevel: 1 });

// Compound indexes
medicineSchema.index({ isActive: 1, category: 1 });
medicineSchema.index({ isActive: 1, createdAt: -1 });

/**
 * Pre-save hook: Ensure selling price >= cost
 */
medicineSchema.pre("save", function (next) {
  if (this.sellingPrice < this.unitCost) {
    this.sellingPrice = this.unitCost;
  }

  // Auto-set discontinuedDate if isActive changes to false
  if (!this.isActive && !this.discontinuedDate) {
    this.discontinuedDate = new Date();
  }

  next();
});

/**
 * Static method: Find by registration number
 */
medicineSchema.statics.findByRegistration = function (regNumber: string) {
  return this.findOne({ registrationNumber: regNumber });
};

/**
 * Static method: Find active medicines
 */
medicineSchema.statics.findActive = function () {
  return this.find({ isActive: true, discontinuedDate: null }).sort({ name: 1 });
};

/**
 * Static method: Find by category
 */
medicineSchema.statics.findByCategory = function (categoryId: Types.ObjectId) {
  return this.find({ category: categoryId, isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find by manufacturer
 */
medicineSchema.statics.findByManufacturer = function (manufacturerId: Types.ObjectId) {
  return this.find({ manufacturer: manufacturerId, isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find scheduled medicines
 */
medicineSchema.statics.findScheduled = function () {
  return this.find({ isScheduled: true, isActive: true }).sort({ name: 1 });
};

/**
 * Instance method: Is available for exchange
 */
medicineSchema.methods.isAvailableForExchange = function (): boolean {
  return this.isActive && !this.discontinuedDate;
};

/**
 * Instance method: Get margin percentage
 */
medicineSchema.methods.getMarginPercentage = function (): number {
  const margin = this.sellingPrice - this.unitCost;
  return (margin / this.unitCost) * 100;
};

/**
 * Instance method: Requires special handling
 */
medicineSchema.methods.requiresSpecialHandling = function (): boolean {
  return (
    this.isScheduled ||
    this.storageTemperature === "2-8°C" ||
    this.storageConditions.length > 0
  );
};

/**
 * Medicine Model
 */
export const Medicine = model<IMedicine>("Medicine", medicineSchema);