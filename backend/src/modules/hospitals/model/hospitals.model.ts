import { Schema, model, Document, Types } from "mongoose";

/**
 * Address embedded document interface
 */
export interface IHospitalAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

/**
 * Interface for Hospitals
 * Store hospital/organization details
 */
export interface IHospital extends Document {
  _id: Types.ObjectId;
  name: string;
  registrationNumber: string;
  licenseNumber: string;
  organizationType: "government" | "private" | "ngo" | "research" | "teaching";
  email: string;
  phoneNumber: string;
  website?: string;
  address: IHospitalAddress;
  bedsCount: number;
  specializations: string[];
  accreditations: string[];
  taxId: string; // GSTIN for India
  paymentTerms: string;
  isActive: boolean;
  isVerified: boolean;
  verificationDate?: Date;
  totalBranches: number; // Denormalized for quick access
  admissionCount?: number; // Denormalized metrics
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hospital Address Embedded Schema
 */
const hospitalAddressSchema = new Schema<IHospitalAddress>(
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
          return /^[0-9]{6}$/.test(v); // Indian PIN code
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
      min: [-90, "Latitude must be between -90 and 90"],
      max: [90, "Latitude must be between -90 and 90"],
    },

    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: [-180, "Longitude must be between -180 and 180"],
      max: [180, "Longitude must be between -180 and 180"],
    },
  },
  { _id: false }
);

/**
 * Hospital Schema
 * Store hospital/organization details
 */
const hospitalSchema = new Schema<IHospital>(
  {
    name: {
      type: String,
      required: [true, "Hospital name is required"],
      unique: true,
      trim: true,
      minlength: [3, "Hospital name must be at least 3 characters"],
      maxlength: [100, "Hospital name must not exceed 100 characters"],
      index: true,
    },

    registrationNumber: {
      type: String,
      required: [true, "Registration number is required"],
      unique: true,
      trim: true,
      minlength: [5, "Registration number must be at least 5 characters"],
      maxlength: [50, "Registration number must not exceed 50 characters"],
      index: true,
      validate: {
        validator: function (v: string) {
          return /^[A-Z0-9\-]+$/.test(v);
        },
        message: "Registration number format invalid",
      },
    },

    licenseNumber: {
      type: String,
      required: [true, "License number is required"],
      unique: true,
      trim: true,
      minlength: [5, "License number must be at least 5 characters"],
      maxlength: [50, "License number must not exceed 50 characters"],
      index: true,
    },

    organizationType: {
      type: String,
      required: [true, "Organization type is required"],
      enum: {
        values: ["government", "private", "ngo", "research", "teaching"],
        message:
          "Organization type must be: government, private, ngo, research, or teaching",
      },
      lowercase: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
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

    website: {
      type: String,
      trim: true,
      validate: {
        validator: function (v?: string) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "Invalid website URL",
      },
    },

    address: {
      type: hospitalAddressSchema,
      required: [true, "Address is required"],
    },

    bedsCount: {
      type: Number,
      required: [true, "Beds count is required"],
      min: [1, "Beds count must be at least 1"],
      max: [10000, "Beds count cannot exceed 10000"],
    },

    specializations: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 20;
        },
        message: "Maximum 20 specializations allowed",
      },
    },

    accreditations: {
      type: [String],
      default: [],
      enum: ["JCI", "NABH", "AABB", "CAP", "CLIA", "ISO"],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 10;
        },
        message: "Maximum 10 accreditations allowed",
      },
    },

    taxId: {
      type: String,
      required: [true, "Tax ID (GSTIN) is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
          // GSTIN format: 2digits-5letters-4digits-1letter-1letter-1digit
          return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[0-9]{1}$/.test(
            v
          );
        },
        message: "Invalid GSTIN format",
      },
    },

    paymentTerms: {
      type: String,
      default: "Net 30",
      enum: ["Net 15", "Net 30", "Net 45", "Net 60", "Prepaid"],
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    verificationDate: {
      type: Date,
      validate: {
        validator: function (v?: Date) {
          if (!v) return true;
          return v <= new Date();
        },
        message: "Verification date cannot be in the future",
      },
    },

    totalBranches: {
      type: Number,
      default: 0,
      min: [0, "Total branches cannot be negative"],
      description: "Denormalized field - updated when branches are added/removed",
    },

    admissionCount: {
      type: Number,
      default: 0,
      description: "Optional metric for hospital capacity tracking",
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
hospitalSchema.index({ name: 1 }, { unique: true });
hospitalSchema.index({ registrationNumber: 1 }, { unique: true });
hospitalSchema.index({ licenseNumber: 1 }, { unique: true });
hospitalSchema.index({ email: 1 }, { unique: true });

// Indexes for common queries
hospitalSchema.index({ isActive: 1 });
hospitalSchema.index({ isVerified: 1 });

// Compound indexes
hospitalSchema.index({ isActive: 1, isVerified: 1 });
hospitalSchema.index({ isVerified: 1, createdAt: -1 });

// Geospatial index for location-based queries
hospitalSchema.index({ "address.latitude": 1, "address.longitude": 1 });

// Index for city-based queries
hospitalSchema.index({ "address.city": 1 });

/**
 * Pre-save hook: Auto-verify status
 */
hospitalSchema.pre("save", function (next) {
  if (this.isVerified && !this.verificationDate) {
    this.verificationDate = new Date();
  }

  if (!this.isVerified) {
    this.verificationDate = undefined;
  }

  next();
});

/**
 * Static method: Find active hospitals
 */
hospitalSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find verified hospitals
 */
hospitalSchema.statics.findVerified = function () {
  return this.find({ isVerified: true, isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find by registration number
 */
hospitalSchema.statics.findByRegistration = function (regNumber: string) {
  return this.findOne({ registrationNumber: regNumber });
};

/**
 * Static method: Find by city
 */
hospitalSchema.statics.findByCity = function (city: string) {
  return this.find({ "address.city": city, isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find nearby hospitals (geospatial)
 */
hospitalSchema.statics.findNearby = function (
  latitude: number,
  longitude: number,
  maxDistance: number = 50000 // 50km in meters
) {
  return this.find({
    isActive: true,
    "address.location": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
  });
};

/**
 * Instance method: Is verified?
 */
hospitalSchema.methods.isVerifiedHospital = function (): boolean {
  return this.isVerified && this.isActive;
};

/**
 * Instance method: Get full address as string
 */
hospitalSchema.methods.getFullAddress = function (): string {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`;
};

/**
 * Instance method: Has accreditation
 */
hospitalSchema.methods.hasAccreditation = function (accreditation: string): boolean {
  return this.accreditations.includes(accreditation);
};

/**
 * Instance method: Verify hospital
 */
hospitalSchema.methods.verify = function (): void {
  this.isVerified = true;
  this.verificationDate = new Date();
};

/**
 * Hospital Model
 */
export const Hospital = model<IHospital>("Hospital", hospitalSchema);
