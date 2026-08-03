import { Schema, model, Document, Types } from "mongoose";

/**
 * Address embedded document interface
 */
export interface IAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Interface for Manufacturers
 * Stores medicine manufacturer details
 */
export interface IManufacturer extends Document {
  _id: Types.ObjectId;
  name: string;
  licenseNumber: string;
  registrationDate: Date;
  email: string;
  phoneNumber: string;
  address: IAddress;
  isActive: boolean;
  certifications: string[]; // ISO, GMP, etc.
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Address Embedded Schema
 */
const addressSchema = new Schema<IAddress>(
  {
    street: {
      type: String,
      required: [true, "Street address is required"],
      minlength: [5, "Street address must be at least 5 characters"],
      maxlength: [100, "Street address must not exceed 100 characters"],
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
          return /^[0-9]{6}$/.test(v); // Indian PIN code format
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
  },
  { _id: false }
);

/**
 * Manufacturer Schema
 * Stores medicine manufacturer details
 */
const manufacturerSchema = new Schema<IManufacturer>(
  {
    name: {
      type: String,
      required: [true, "Manufacturer name is required"],
      unique: true,
      trim: true,
      minlength: [3, "Manufacturer name must be at least 3 characters"],
      maxlength: [100, "Manufacturer name must not exceed 100 characters"],
      index: true,
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

    registrationDate: {
      type: Date,
      required: [true, "Registration date is required"],
      validate: {
        validator: function (v: Date) {
          return v <= new Date();
        },
        message: "Registration date must be in the past",
      },
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

    address: {
      type: addressSchema,
      required: [true, "Address is required"],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    certifications: {
      type: [String],
      default: [],
      enum: ["ISO", "GMP", "ISO9001", "ISO14001", "ISO45001", "FDA", "CE"],
      description: "Quality and regulatory certifications",
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
manufacturerSchema.index({ name: 1 }, { unique: true });
manufacturerSchema.index({ licenseNumber: 1 }, { unique: true });

// Indexes for common queries
manufacturerSchema.index({ isActive: 1 });
manufacturerSchema.index({ email: 1 });

// Compound indexes
manufacturerSchema.index({ isActive: 1, registrationDate: -1 });

/**
 * Pre-save hook: Validate email is unique (case-insensitive)
 */
manufacturerSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("email")) {
    const existingManufacturer = await Manufacturer.findOne({
      email: this.email.toLowerCase(),
      _id: { $ne: this._id },
    });

    if (existingManufacturer) {
      throw new Error("Email already registered for another manufacturer");
    }
  }
  next();
});

/**
 * Static method: Find active manufacturers
 */
manufacturerSchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

/**
 * Static method: Find by license number
 */
manufacturerSchema.statics.findByLicense = function (licenseNumber: string) {
  return this.findOne({ licenseNumber });
};

/**
 * Instance method: Has certification
 */
manufacturerSchema.methods.hasCertification = function (cert: string): boolean {
  return this.certifications.includes(cert);
};

/**
 * Instance method: Get all certifications as string
 */
manufacturerSchema.methods.getCertificationsString = function (): string {
  return this.certifications.join(", ");
};

/**
 * Manufacturer Model
 */
export const Manufacturer = model<IManufacturer>(
  "Manufacturer",
  manufacturerSchema
);
