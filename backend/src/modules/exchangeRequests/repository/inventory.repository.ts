import { Types } from "mongoose";
import { Inventory, IInventory } from "../../inventery/model/inventery.model";

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

/**
 * Minimal read/write access to Inventory, scoped to what
 * exchangeRequest.service.ts needs to reserve/release/move stock across the
 * exchange lifecycle.
 */
export function findById(id: string | Types.ObjectId) {
  return Inventory.findById(id);
}

export function findByBatch(
  hospitalId: string | Types.ObjectId,
  branchId: string | Types.ObjectId,
  medicineId: string | Types.ObjectId,
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
