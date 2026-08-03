import { Schema, model, Document, Types } from "mongoose";

/**
 * Interface for Roles
 * Defines role types and their associated permissions
 */
export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string; // "admin", "hospital_manager", "pharmacist", "viewer"
  description: string;
  permissions: Types.ObjectId[]; // Array of permission IDs
  isActive: boolean;
  isSystem: boolean; // System roles cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role Schema
 * Defines the structure for role documents in MongoDB
 */
const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [2, "Role name must be at least 2 characters"],
      maxlength: [50, "Role name must not exceed 50 characters"],
      validate: {
        validator: function (v: string) {
          return /^[a-z0-9_]+$/.test(v);
        },
        message: "Role name must contain only lowercase letters, numbers, and underscores",
      },
    },

    description: {
      type: String,
      required: [true, "Role description is required"],
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [500, "Description must not exceed 500 characters"],
    },

    permissions: {
      type: [Schema.Types.ObjectId],
      ref: "Permission",
      default: [],
      validate: {
        validator: async function (v: Types.ObjectId[]) {
          if (v.length === 0) return true; // Permissions are optional at creation
          // Validation will be done at service layer
          return true;
        },
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isSystem: {
      type: Boolean,
      default: false,
      description: "System roles cannot be deleted by users",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Unique index on name
roleSchema.index({ name: 1 }, { unique: true });

// Index for active roles queries
roleSchema.index({ isActive: 1 });

// Compound index for role lookups with status
roleSchema.index({ isActive: 1, isSystem: 1 });

/**
 * Pre-save hook: Ensure system roles are always active
 */
roleSchema.pre("save", function (next) {
  if (this.isSystem === true) {
    this.isActive = true;
  }
  next();
});

/**
 * Pre-delete hook: Prevent deletion of system roles
 */
roleSchema.pre("deleteOne", async function (next) {
  const role = await Role.findById(this.getFilter()._id);
  if (role?.isSystem) {
    throw new Error("Cannot delete system roles");
  }
  next();
});

/**
 * Static method: Find by name
 */
roleSchema.statics.findByName = function (name: string) {
  return this.findOne({ name: name.toLowerCase() });
};

/**
 * Instance method: Check if role is editable
 */
roleSchema.methods.isEditable = function (): boolean {
  return !this.isSystem;
};

/**
 * Role Model
 */
export const Role = model<IRole>("Role", roleSchema);

/**
 * Predefined System Roles (for seeding)
 */
export const SYSTEM_ROLES = {
  ADMIN: "admin",
  HOSPITAL_MANAGER: "hospital_manager",
  PHARMACIST: "pharmacist",
  VIEWER: "viewer",
} as const;
