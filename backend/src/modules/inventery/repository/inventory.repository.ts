import { Types } from "mongoose";
import { Inventory, IInventory } from "../model/inventery.model";

export interface CreateInventoryData {
  hospital: Types.ObjectId;
  branch: Types.ObjectId;
  medicine: Types.ObjectId;
  quantityInStock: number;
  batchNumber: string;
  manufacturingDate: Date;
  expiryDate: Date;
  storageLocation?: string;
  cost: number;
}

export function findById(id: string | Types.ObjectId) {
  return Inventory.findById(id);
}

export function findByBatch(
  hospitalId: string | Types.ObjectId,
  branchId: string | Types.ObjectId,
  medicineId: string,
  batchNumber: string
) {
  return Inventory.findOne({
    hospital: hospitalId,
    branch: branchId,
    medicine: medicineId,
    batchNumber: batchNumber.toUpperCase(),
  });
}

export function createInventory(data: CreateInventoryData) {
  return Inventory.create(data);
}

export function saveInventory(inventory: IInventory) {
  return inventory.save();
}

export interface ListFilter {
  status?: "active" | "expiring_soon" | "expired" | "obsolete";
  medicine?: string;
}

export async function listByBranch(
  hospitalId: string,
  branchId: string,
  filter: ListFilter,
  page: number,
  limit: number
): Promise<{ items: IInventory[]; total: number }> {
  const query: Record<string, unknown> = { hospital: hospitalId, branch: branchId };
  if (filter.status) query.status = filter.status;
  if (filter.medicine) query.medicine = filter.medicine;

  const [items, total] = await Promise.all([
    Inventory.find(query)
      .sort({ expiryDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("medicine", "name genericName strength form reorderLevel"),
    Inventory.countDocuments(query),
  ]);
  return { items, total };
}

/**
 * All non-expired inventory rows for a hospital (across every branch),
 * with medicine populated — backs the expiring/low-stock hospital-wide
 * queries in inventory.service.ts.
 */
export function listActiveForHospital(hospitalId: string) {
  return Inventory.find({ hospital: hospitalId, status: { $ne: "expired" } }).populate(
    "medicine",
    "name genericName strength form reorderLevel unitOfMeasure"
  );
}
