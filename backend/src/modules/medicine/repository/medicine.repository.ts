import { Types } from "mongoose";
import { Medicine, IMedicine } from "../model/medicine.model";

export interface CreateMedicineData {
  name: string;
  genericName: string;
  hsn_sac: string;
  gst_rate: number;
  category: Types.ObjectId;
  manufacturer: Types.ObjectId;
  strength: string;
  form: string;
  registrationNumber: string;
  isScheduled?: boolean;
  scheduleType?: string;
  reorderLevel: number;
  maxStockLevel: number;
  unitOfMeasure: string;
  shelfLife: number;
  storageTemperature: string;
  storageConditions?: string[];
  unitCost: number;
  sellingPrice: number;
}

export function findById(id: string | Types.ObjectId) {
  return Medicine.findById(id);
}

export function findByRegistrationNumber(registrationNumber: string) {
  return Medicine.findOne({ registrationNumber });
}

export function createMedicine(data: CreateMedicineData) {
  return Medicine.create(data);
}

export function saveMedicine(medicine: IMedicine) {
  return medicine.save();
}

export interface ListFilter {
  isActive?: boolean;
  category?: string;
  manufacturer?: string;
  search?: string;
}

export async function list(
  filter: ListFilter,
  page: number,
  limit: number
): Promise<{ items: IMedicine[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  if (filter.category) query.category = filter.category;
  if (filter.manufacturer) query.manufacturer = filter.manufacturer;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { genericName: { $regex: filter.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Medicine.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Medicine.countDocuments(query),
  ]);
  return { items, total };
}
