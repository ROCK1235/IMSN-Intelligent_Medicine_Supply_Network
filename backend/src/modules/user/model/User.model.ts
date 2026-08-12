import { Schema, model, Document, Types } from "mongoose";
import bcrypt from "bcrypt";
import { th } from "zod/v4/locales";
import { Role } from "../../roles/model/roles.model";
import { Hospital } from "../../hospitals/model/hospitals.model";
import { Branch } from "../../branches/model/branches.model";
import { generateSequentialId } from "../../counter/service/counter.service";

/**
 * Login history interface
*/
export interface ILoginRecord {
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

/**
 * Interface for Users
 * Store user accounts with authentication details
 */
export interface IUser extends Document {
  _id: Types.ObjectId;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  password: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  role: Types.ObjectId; // Reference to roles
  hospital?: Types.ObjectId; // Reference to hospitals (optional for admins)
  branch?: Types.ObjectId; // Reference to branches (optional)
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  loginHistory: ILoginRecord[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  hashPassword(): Promise<void>;
  getFullName(): string;
  isAccountLocked(): boolean;
}

/**
 * Login record schema
 */
const loginRecordSchema = new Schema<ILoginRecord>(
  {
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ipAddress: String,
    userAgent: String,
  },
  { _id: false }
);

/**
 * User Schema
 * Store user accounts with authentication details
 */
const userSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name must not exceed 50 characters"],
      validate: {
        validator: function (v: string) {
          return /^[a-zA-Z\s'-]+$/.test(v);
        },
        message:
          "First name must contain only letters, spaces, hyphens, or apostrophes",
      },
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
      maxlength: [50, "Last name must not exceed 50 characters"],
      validate: {
        validator: function (v: string) {
          return /^[a-zA-Z\s'-]+$/.test(v);
        },
        message:
          "Last name must contain only letters, spaces, hyphens, or apostrophes",
      },
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
      trim: true,
      sparse: true,
      unique: true,
      validate: {
        validator: function (v?: string) {
          if (!v) return true;
          return /^[\d\s\-\+\(\)]{10,15}$/.test(v);
        },
        message: "Invalid phone number format",
      },
    },

    avatar: {
      type: String,
      trim: true,
      validate: {
        validator: function (v?: string) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "Invalid avatar URL",
      },
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [128, "Password must not exceed 128 characters"],
      select: false, // Don't return password by default
      validate: {
        validator: function (v: string) {
          return (
            /[A-Z]/.test(v) && // Uppercase
            /[a-z]/.test(v) && // Lowercase
            /\d/.test(v) && // Digit
            /[!@#$%^&*]/.test(v) // Special character
          );
        },
        message:
          "Password must contain uppercase, lowercase, digit, and special character",
      },
    },

    passwordChangedAt: Date,

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    role: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "Role is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const role = await Role.findById(v);
          if (!role || !role.isActive) {
            throw new Error("Role must exist and be active");
          }
          return true;
        },
      },
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      validate: {
        validator: async function (v?: Types.ObjectId) {
          if (!v) return true;
          const hospital = await Hospital.findById(v);
          if (!hospital || !hospital.isActive) {
            throw new Error("Hospital must exist and be active");
          }
          return true;
        },
      },
    },

    branch: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      validate: {
        validator: async function (v?: Types.ObjectId) {
          if (!v) return true;

          const branch = await Branch.findById(v);
          if (!branch || !branch.isActive) {
            throw new Error("Branch must exist and be active");
          }

          // Verify branch belongs to user's hospital
          if (this.hospital && !branch.hospital.equals(this.hospital)) {
            throw new Error("Branch must belong to assigned hospital");
          }

          return true;
        },
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    lastLoginAt: Date,

    loginAttempts: {
      type: Number,
      default: 0,
      min: [0, "Login attempts cannot be negative"],
    },

    lockedUntil: Date,

    loginHistory: {
      type: [loginRecordSchema],
      default: [],
      validate: {
        validator: function (v: ILoginRecord[]) {
          // Keep only last 10 logins
          return v.length <= 10;
        },
      },
    },

    deletedAt: {
      type: Date,
      select: false,
      default: null,
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
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { sparse: true, unique: true });

// Indexes for common queries
userSchema.index({ hospital: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Compound indexes
userSchema.index({ isActive: 1, hospital: 1 });
userSchema.index({ hospital: 1, role: 1 });

/**
 * Pre-save hook: Auto-generate sequential user ID
 */
userSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      this.userId = await generateSequentialId("user", "USR");
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Pre-save hook: Hash password before saving
 */
userSchema.pre("save", async function (next) {
  // Only hash password if it's new or modified
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);

    // Set passwordChangedAt if password is modified (not on creation)
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000);
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Pre-save hook: Unlock account if lockout period expired
 */
userSchema.pre("save", function (next) {
  if (this.lockedUntil && this.lockedUntil < new Date()) {
    this.lockedUntil = undefined;
    this.loginAttempts = 0;
  }
  next();
});

/**
 * Instance method: Compare password
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method: Hash password
 */
userSchema.methods.hashPassword = async function (): Promise<void> {
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
};

/**
 * Instance method: Get full name
 */
userSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

/**
 * Instance method: Check if account is locked
 */
userSchema.methods.isAccountLocked = function (): boolean {
  return !!this.lockedUntil && this.lockedUntil > new Date();
};

/**
 * Instance method: Increment login attempts
 */
userSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  // Reset attempts if lock has expired
  if (this.lockedUntil && this.lockedUntil < new Date()) {
    return this.resetLoginAttempts();
  }

  // Increment attempts
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts for 15 minutes
  if (this.loginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }

  await this.save();
};

/**
 * Instance method: Reset login attempts
 */
userSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  this.loginAttempts = 0;
  this.lockedUntil = undefined;
  this.lastLoginAt = new Date();

  // Add to login history (keep last 10)
  if (!this.loginHistory) {
    this.loginHistory = [];
  }
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress: "", // Will be set in controller
    userAgent: "", // Will be set in controller
  });
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(-10);
  }

  await this.save();
};

/**
 * Instance method: Is deleted (soft delete check)
 */
userSchema.methods.isDeleted = function (): boolean {
  return !!this.deletedAt;
};

/**
 * Static method: Find active users only
 */
userSchema.statics.findActive = function () {
  return this.find({ isActive: true, deletedAt: null }).sort({ lastName: 1 });
};

/**
 * Static method: Find by hospital
 */
userSchema.statics.findByHospital = function (hospitalId: Types.ObjectId) {
  return this.find({
    hospital: hospitalId,
    isActive: true,
    deletedAt: null,
  }).sort({ lastName: 1 });
};

/**
 * Static method: Find by role
 */
userSchema.statics.findByRole = function (roleId: Types.ObjectId) {
  return this.find({
    role: roleId,
    isActive: true,
    deletedAt: null,
  }).sort({ lastName: 1 });
};

/**
 * User Model
 */
export const User = model<IUser>("User", userSchema);