import { Types } from "mongoose";
import { MedicineCategory, IMedicineCategory } from "../model/medicineCategories.model";

export interface CreateCategoryData {
  name: string;
  description?: string;
  code: string;
  parentCategory?: Types.ObjectId;
  displayOrder?: number;
}

export function findById(id: string | Types.ObjectId) {
  return MedicineCategory.findById(id);
}

export function findByName(name: string) {
  return MedicineCategory.findOne({ name });
}

export function findByCode(code: string) {
  return MedicineCategory.findOne({ code: code.toUpperCase() });
}

export function createCategory(data: CreateCategoryData) {
  return MedicineCategory.create(data);
}

export function saveCategory(category: IMedicineCategory) {
  return category.save();
}

export async function list(
  filter: { isActive?: boolean; parentCategory?: string | null },
  page: number,
  limit: number
): Promise<{ items: IMedicineCategory[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  if (filter.parentCategory !== undefined) query.parentCategory = filter.parentCategory;

  const [items, total] = await Promise.all([
    MedicineCategory.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    MedicineCategory.countDocuments(query),
  ]);
  return { items, total };
}
