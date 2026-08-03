import { Schema, model, Document, Types } from "mongoose";

/**
 * Interface for Medicine Categories
 * Organizes medicines into categories
 */
export interface IMedicineCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  code: string;
  parentCategory?: Types.ObjectId; // Optional parent for hierarchy
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Medicine Category Schema
 * Organizes medicines into categories
 */
const medicineCategorySchema = new Schema<IMedicineCategory>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      minlength: [3, "Category name must be at least 3 characters"],
      maxlength: [50, "Category name must not exceed 50 characters"],
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must not exceed 500 characters"],
    },

    code: {
      type: String,
      required: [true, "Category code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Code must be at least 3 characters"],
      maxlength: [20, "Code must not exceed 20 characters"],
      validate: {
        validator: function (v: string) {
          return /^[A-Z0-9\-]+$/.test(v);
        },
        message: "Code must contain only uppercase letters, numbers, and hyphens",
      },
      index: true,
    },

    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "MedicineCategory",
      default: null,
      validate: {
        validator: async function (v: Types.ObjectId | null) {
          if (!v) return true; // Parent is optional

          // Prevent self-reference
          if (v.equals(this._id)) {
            throw new Error("Category cannot be its own parent");
          }

          // Check parent exists and is active
          const parent = await MedicineCategory.findById(v);
          if (!parent || !parent.isActive) {
            throw new Error("Parent category must exist and be active");
          }

          // Prevent circular reference (simple check)
          if (parent.parentCategory?.equals(this._id)) {
            throw new Error("Circular parent-child relationship not allowed");
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

    displayOrder: {
      type: Number,
      default: 999,
      min: [0, "Display order must be non-negative"],
      description: "For sorting categories in UI",
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
medicineCategorySchema.index({ name: 1 }, { unique: true });
medicineCategorySchema.index({ code: 1 }, { unique: true });

// Indexes for common queries
medicineCategorySchema.index({ isActive: 1 });
medicineCategorySchema.index({ parentCategory: 1 });

// Compound indexes for sorting and filtering
medicineCategorySchema.index({ isActive: 1, displayOrder: 1 });
medicineCategorySchema.index({ parentCategory: 1, isActive: 1, displayOrder: 1 });

/**
 * Pre-save hook: Validate parent category is not the same as this category
 */
medicineCategorySchema.pre("save", async function (next) {
  if (this.parentCategory && this.parentCategory.equals(this._id)) {
    throw new Error("A category cannot be its own parent");
  }
  next();
});

/**
 * Pre-delete hook: Prevent deletion if category has subcategories or medicines
 */
medicineCategorySchema.pre("deleteOne", async function (next) {
  const categoryId = this.getFilter()._id;

  // Check for subcategories
  const subcategories = await MedicineCategory.countDocuments({
    parentCategory: categoryId,
  });

  if (subcategories > 0) {
    throw new Error("Cannot delete category that has subcategories");
  }

  // Check for medicines (via Medicine model - will validate at service layer)
  // const medicines = await Medicine.countDocuments({ category: categoryId });
  // if (medicines > 0) {
  //   throw new Error("Cannot delete category that has medicines");
  // }

  next();
});

/**
 * Static method: Find all root categories (no parent)
 */
medicineCategorySchema.statics.findRootCategories = function () {
  return this.find({ parentCategory: null, isActive: true })
    .sort({ displayOrder: 1, name: 1 });
};

/**
 * Static method: Find all active categories
 */
medicineCategorySchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

/**
 * Static method: Find by code
 */
medicineCategorySchema.statics.findByCode = function (code: string) {
  return this.findOne({ code: code.toUpperCase() });
};

/**
 * Instance method: Get subcategories
 */
medicineCategorySchema.methods.getSubcategories = function () {
  return MedicineCategory.find({ parentCategory: this._id, isActive: true })
    .sort({ displayOrder: 1, name: 1 });
};

/**
 * Instance method: Get parent category
 */
medicineCategorySchema.methods.getParentCategory = function () {
  if (!this.parentCategory) return null;
  return MedicineCategory.findById(this.parentCategory);
};

/**
 * Instance method: Get full path (parent -> subcategory)
 */
medicineCategorySchema.methods.getFullPath = async function (): Promise<
  string[]
> {
  const path = [this.name];

  let current = this;
  while (current.parentCategory) {
    const parent = await MedicineCategory.findById(current.parentCategory);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }

  return path;
};

/**
 * Medicine Category Model
 */
export const MedicineCategory = model<IMedicineCategory>(
  "MedicineCategory",
  medicineCategorySchema
);
