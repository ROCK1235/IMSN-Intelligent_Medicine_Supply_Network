import { Schema, model, Document, Types } from "mongoose";
import { Hospital } from "../../hospitals/model/hospitals.model";
import { generateSequentialId } from "../../counter/service/counter.service";

/**
 * Operating hours for a single day
 */
export interface IDayHours {
  open: string; // "09:00"
  close: string; // "17:00"
}

/**
 * Operating hours embedded document
 */
export interface IOperatingHours {
  monday: IDayHours;
  tuesday: IDayHours;
  wednesday: IDayHours;
  thursday: IDayHours;
  friday: IDayHours;
  saturday: IDayHours;
  sunday: IDayHours;
}

/**
 * Branch address interface
 */
export interface IBranchAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

/**
 * Interface for Branches
 * Manage hospital branches/departments
 */
export interface IBranch extends Document {
  _id: Types.ObjectId;
  branchId: string;
  name: string;
  code: string; // Unique per hospital
  branchType: "main" | "satellite" | "dispensary" | "clinic" | "pharmacy";
  hospital: Types.ObjectId; // Reference to hospital
  address: IBranchAddress;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  bedsCount: number;
  operatingHours: IOperatingHours;
  isActive: boolean;
  medicineStorageCapacity: number;
  refrigeratorCapacity: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Day hours schema
 */
const dayHoursSchema = new Schema<IDayHours>(
  {
    open: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Invalid time format. Use HH:MM (24-hour format)",
      },
    },
    close: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Invalid time format. Use HH:MM (24-hour format)",
      },
    },
  },
  { _id: false }
);

/**
 * Operating hours schema
 */
const operatingHoursSchema = new Schema<IOperatingHours>(
  {
    monday: { type: dayHoursSchema, required: true },
    tuesday: { type: dayHoursSchema, required: true },
    wednesday: { type: dayHoursSchema, required: true },
    thursday: { type: dayHoursSchema, required: true },
    friday: { type: dayHoursSchema, required: true },
    saturday: { type: dayHoursSchema, required: true },
    sunday: { type: dayHoursSchema, required: true },
  },
  { _id: false }
);

/**
 * Branch address schema
 */
const branchAddressSchema = new Schema<IBranchAddress>(
  {
    street: {
      type: String,
      required: [true, "Street address is required"],
      minlength: [5, "Street must be at least 5 characters"],
      maxlength: [100, "Street must not exceed 100 characters"],
      trim: true,
    },

    city: {
      type: String,
      required: [true, "City is required"],
      minlength: [2, "City must be at least 2 characters"],
      maxlength: [50, "City must not exceed 50 characters"],
      trim: true,
    },

    state: {
      type: String,
      required: [true, "State is required"],
      minlength: [2, "State must be at least 2 characters"],
      maxlength: [50, "State must not exceed 50 characters"],
      trim: true,
    },

    postalCode: {
      type: String,
      required: [true, "Postal code is required"],
      validate: {
        validator: function (v: string) {
          return /^[0-9]{6}$/.test(v);
        },
        message: "Postal code must be 6 digits",
      },
    },

    country: {
      type: String,
      required: [true, "Country is required"],
      default: "India",
      trim: true,
    },

    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: [-90, "Invalid latitude"],
      max: [90, "Invalid latitude"],
    },

    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: [-180, "Invalid longitude"],
      max: [180, "Invalid longitude"],
    },
  },
  { _id: false }
);

/**
 * Branch Schema
 * Manage hospital branches/departments
 */
const branchSchema = new Schema<IBranch>(
  {
    branchId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
      minlength: [2, "Branch name must be at least 2 characters"],
      maxlength: [100, "Branch name must not exceed 100 characters"],
    },

    code: {
      type: String,
      required: [true, "Branch code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Code must be at least 3 characters"],
      maxlength: [20, "Code must not exceed 20 characters"],
      index: true,
      validate: {
        validator: function (v: string) {
          return /^[A-Z0-9\-]+$/.test(v);
        },
        message: "Code must contain only uppercase letters, numbers, and hyphens",
      },
    },

    branchType: {
      type: String,
      required: [true, "Branch type is required"],
      enum: {
        values: ["main", "satellite", "dispensary", "clinic", "pharmacy"],
        message: "Invalid branch type",
      },
      lowercase: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: [true, "Hospital is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const hospital = await Hospital.findById(v);
          if (!hospital) {
            throw new Error("Hospital not found");
          }
          if (!hospital.isActive) {
            throw new Error("Hospital must be active");
          }
          return true;
        },
      },
    },

    address: {
      type: branchAddressSchema,
      required: [true, "Address is required"],
    },

    contactPerson: {
      type: String,
      required: [true, "Contact person is required"],
      trim: true,
      minlength: [2, "Contact person name must be at least 2 characters"],
      maxlength: [100, "Contact person name must not exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email format",
      },
    },

    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[\d\s\-\+\(\)]{10,15}$/.test(v);
        },
        message: "Invalid phone number format",
      },
    },

    bedsCount: {
      type: Number,
      default: 0,
      min: [0, "Beds count cannot be negative"],
    },

    operatingHours: {
      type: operatingHoursSchema,
      required: [true, "Operating hours are required"],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    medicineStorageCapacity: {
      type: Number,
      default: 0,
      min: [0, "Storage capacity cannot be negative"],
      description: "Storage units available for medicines",
    },

    refrigeratorCapacity: {
      type: Number,
      default: 0,
      min: [0, "Refrigerator capacity cannot be negative"],
      description: "Cold storage units for temperature-sensitive medicines",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Unique index on code
branchSchema.index({ code: 1 }, { unique: true });

// Indexes for common queries
branchSchema.index({ hospital: 1 });
branchSchema.index({ isActive: 1 });

// Compound indexes
branchSchema.index({ hospital: 1, isActive: 1 });
branchSchema.index({ hospital: 1, branchType: 1 });

// Geographic index
branchSchema.index({ "address.city": 1 });

/**
 * Pre-save hook: Auto-generate sequential branch ID
 */
branchSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.branchId = await generateSequentialId("branch", "BRN");
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Pre-save hook: Validate closing time is after opening time
 */
branchSchema.pre("save", function (next) {
  const validateDay = (day: IDayHours) => {
    const openTime = parseInt(day.open.replace(":", ""));
    const closeTime = parseInt(day.close.replace(":", ""));
    if (closeTime <= openTime) {
      throw new Error("Closing time must be after opening time");
    }
  };

  try {
    Object.values(this.operatingHours).forEach(validateDay);
  } catch (error) {
    return next(error as Error);
  }

  next();
});

/**
 * Static method: Find all branches of a hospital
 */
branchSchema.statics.findByHospital = function (hospitalId: Types.ObjectId) {
  return this.find({ hospital: hospitalId, isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find by code
 */
branchSchema.statics.findByCode = function (code: string) {
  return this.findOne({ code: code.toUpperCase() });
};

/**
 * Static method: Find main branches
 */
branchSchema.statics.findMainBranches = function () {
  return this.find({ branchType: "main", isActive: true });
};

/**
 * Static method: Find by city
 */
branchSchema.statics.findByCity = function (city: string) {
  return this.find({ "address.city": city, isActive: true }).sort({ name: 1 });
};

/**
 * Instance method: Is open now
 */
branchSchema.methods.isOpenNow = function (): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ] as const;
  const dayName = dayNames[dayOfWeek];

  const dayHours = this.operatingHours[dayName];
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return currentTime >= dayHours.open && currentTime <= dayHours.close;
};

/**
 * Instance method: Get operating hours for a specific day
 */
branchSchema.methods.getDayHours = function (
  dayName: keyof IOperatingHours
): IDayHours {
  return this.operatingHours[dayName];
};

/**
 * Instance method: Get full address as string
 */
branchSchema.methods.getFullAddress = function (): string {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`;
};

/**
 * Branch Model
 */
export const Branch = model<IBranch>("Branch", branchSchema);
