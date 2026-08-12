import { Types } from "mongoose";
import { IInventory } from "../model/inventery.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { INVENTORY_MESSAGES, MEDICINE_MESSAGES, BRANCH_MESSAGES } from "../../../constants/messages";
import { assertSameHospital } from "../../../utils/authorization";
import * as inventoryRepository from "../repository/inventory.repository";
import * as medicineRepository from "../repository/medicine.repository";
import * as branchRepository from "../repository/branch.repository";
import * as transactionRepository from "../../Inventorytransactions/repository/inventoryTransaction.repository";
import {
  ReceiveStockInput,
  StockAdjustmentInput,
  UpdateInventoryInput,
} from "../validator/inventory.validator";

export interface Actor {
  id: string;
  role: string;
  hospital?: string;
}

interface PopulatedMedicineRef {
  _id: Types.ObjectId;
  name: string;
  genericName: string;
  strength: string;
  form: string;
  reorderLevel: number;
  unitOfMeasure?: string;
}

async function assertBranchInHospital(hospitalId: string, branchId: string) {
  const branch = await branchRepository.findById(branchId);
  if (!branch || branch.hospital.toString() !== hospitalId || !branch.isActive) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, BRANCH_MESSAGES.HOSPITAL_INACTIVE);
  }
}

export async function receiveStock(
  actor: Actor,
  hospitalId: string,
  branchId: string,
  input: ReceiveStockInput
): Promise<IInventory> {
  assertSameHospital(actor, hospitalId);
  await assertBranchInHospital(hospitalId, branchId);

  const medicine = await medicineRepository.findById(input.medicineId);
  if (!medicine || !medicine.isActive) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, MEDICINE_MESSAGES.NOT_FOUND);
  }

  const existing = await inventoryRepository.findByBatch(
    hospitalId,
    branchId,
    input.medicineId,
    input.batchNumber
  );

  const performedBy = new Types.ObjectId(actor.id);
  const hospitalObjId = new Types.ObjectId(hospitalId);
  const branchObjId = new Types.ObjectId(branchId);
  const medicineObjId = new Types.ObjectId(input.medicineId);

  if (existing) {
    // Same batch received again — top up the existing row rather than
    // violate the (hospital, branch, medicine, batchNumber) uniqueness.
    const quantityBefore = existing.quantityInStock;
    existing.quantityInStock += input.quantityInStock;
    existing.cost = existing.quantityInStock * medicine.unitCost;
    await inventoryRepository.saveInventory(existing);

    await transactionRepository.createTransaction({
      transactionType: "stock_in",
      hospital: hospitalObjId,
      branch: branchObjId,
      medicine: medicineObjId,
      inventory: existing._id,
      quantity: input.quantityInStock,
      quantityBefore,
      quantityAfter: existing.quantityInStock,
      performedBy,
      cost: input.quantityInStock * medicine.unitCost,
    });

    return existing;
  }

  const inventory = await inventoryRepository.createInventory({
    hospital: hospitalObjId,
    branch: branchObjId,
    medicine: medicineObjId,
    quantityInStock: input.quantityInStock,
    batchNumber: input.batchNumber,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate,
    storageLocation: input.storageLocation,
    cost: input.quantityInStock * medicine.unitCost,
  });

  await transactionRepository.createTransaction({
    transactionType: "stock_in",
    hospital: hospitalObjId,
    branch: branchObjId,
    medicine: medicineObjId,
    inventory: inventory._id,
    quantity: input.quantityInStock,
    quantityBefore: 0,
    quantityAfter: input.quantityInStock,
    performedBy,
    cost: input.quantityInStock * medicine.unitCost,
  });

  return inventory;
}

async function getInventoryOrThrow(
  hospitalId: string,
  branchId: string,
  inventoryId: string
): Promise<IInventory> {
  const inventory = await inventoryRepository.findById(inventoryId);
  if (
    !inventory ||
    inventory.hospital.toString() !== hospitalId ||
    inventory.branch.toString() !== branchId
  ) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, INVENTORY_MESSAGES.NOT_FOUND);
  }
  return inventory;
}

export async function getInventory(
  actor: Actor,
  hospitalId: string,
  branchId: string,
  inventoryId: string
): Promise<IInventory> {
  assertSameHospital(actor, hospitalId);
  return getInventoryOrThrow(hospitalId, branchId, inventoryId);
}

export async function listInventory(
  actor: Actor,
  hospitalId: string,
  branchId: string,
  filter: inventoryRepository.ListFilter,
  page: number,
  limit: number
) {
  assertSameHospital(actor, hospitalId);
  return inventoryRepository.listByBranch(hospitalId, branchId, filter, page, limit);
}

export async function adjustStock(
  actor: Actor,
  hospitalId: string,
  branchId: string,
  inventoryId: string,
  input: StockAdjustmentInput
): Promise<IInventory> {
  assertSameHospital(actor, hospitalId);
  const inventory = await getInventoryOrThrow(hospitalId, branchId, inventoryId);

  const medicine = await medicineRepository.findById(inventory.medicine.toString());
  const unitCost = medicine?.unitCost ?? 0;

  const quantityBefore = inventory.quantityInStock;
  let quantityDelta: number;

  if (input.type === "stock_in") {
    quantityDelta = input.quantity;
    inventory.quantityInStock += input.quantity;
  } else {
    const removableQuantity = inventory.quantityInStock - inventory.quantityReserved;
    if (input.quantity > removableQuantity) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, INVENTORY_MESSAGES.INSUFFICIENT_STOCK);
    }
    quantityDelta = -input.quantity;
    inventory.quantityInStock -= input.quantity;
  }

  inventory.cost = inventory.quantityInStock * unitCost;
  await inventoryRepository.saveInventory(inventory);

  await transactionRepository.createTransaction({
    transactionType: input.type,
    hospital: inventory.hospital,
    branch: inventory.branch as Types.ObjectId,
    medicine: inventory.medicine,
    inventory: inventory._id,
    quantity: quantityDelta,
    quantityBefore,
    quantityAfter: inventory.quantityInStock,
    reason: input.reason,
    notes: input.notes,
    performedBy: new Types.ObjectId(actor.id),
    cost: Math.abs(quantityDelta) * unitCost,
  });

  return inventory;
}

export async function updateInventory(
  actor: Actor,
  hospitalId: string,
  branchId: string,
  inventoryId: string,
  input: UpdateInventoryInput
): Promise<IInventory> {
  const inventory = await getInventory(actor, hospitalId, branchId, inventoryId);
  Object.assign(inventory, input);
  await inventoryRepository.saveInventory(inventory);
  return inventory;
}

export async function listExpiring(actor: Actor, hospitalId: string, days: number) {
  assertSameHospital(actor, hospitalId);
  const rows = await inventoryRepository.listActiveForHospital(hospitalId);
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;

  return rows.filter((row) => row.expiryDate.getTime() - now <= windowMs);
}

export async function listLowStock(actor: Actor, hospitalId: string) {
  assertSameHospital(actor, hospitalId);
  const rows = await inventoryRepository.listActiveForHospital(hospitalId);

  return rows.filter((row) => {
    const medicine = row.medicine as unknown as PopulatedMedicineRef;
    return row.quantityAvailable <= medicine.reorderLevel;
  });
}
