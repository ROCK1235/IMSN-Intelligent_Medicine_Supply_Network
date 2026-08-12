import { Schema, model, Document } from "mongoose";

/**
 * Interface for Permissions
 * Granular RBAC permissions, referenced by Role.permissions
 */
export interface IPermission extends Document {
  name: string; // "MANAGE_HOSPITAL", "CREATE_EXCHANGE_REQUEST", etc.
  description: string;
  resource: string; // "hospital", "user", "inventory", "exchange", "system"
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE";
  scope: "own" | "own_hospital" | "all";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission Schema
 * Granular RBAC permissions, referenced by Role.permissions
 */
const permissionSchema = new Schema<IPermission>(
  {
    name: {
      type: String,
      required: [true, "Permission name is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Permission name must be at least 3 characters"],
      maxlength: [100, "Permission name must not exceed 100 characters"],
      validate: {
        validator: function (v: string) {
          return /^[A-Z0-9_]+$/.test(v);
        },
        message: "Permission name must be uppercase letters, numbers, and underscores",
      },
    },

    description: {
      type: String,
      required: [true, "Permission description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [500, "Description must not exceed 500 characters"],
    },

    resource: {
      type: String,
      required: [true, "Resource is required"],
      trim: true,
      lowercase: true,
      index: true,
    },

    action: {
      type: String,
      required: [true, "Action is required"],
      enum: {
        values: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
        message: "Invalid action",
      },
    },

    scope: {
      type: String,
      required: [true, "Scope is required"],
      enum: {
        values: ["own", "own_hospital", "all"],
        message: "Scope must be own, own_hospital, or all",
      },
      default: "own_hospital",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
permissionSchema.index({ name: 1 }, { unique: true });
permissionSchema.index({ resource: 1, action: 1 });
permissionSchema.index({ isActive: 1 });

/**
 * Permission Model
 */
export const Permission = model<IPermission>("Permission", permissionSchema);
