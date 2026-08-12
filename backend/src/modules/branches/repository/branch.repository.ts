import { Types } from "mongoose";
import {
  Branch,
  IBranch,
  IBranchAddress,
  IOperatingHours,
} from "../model/branches.model";

export interface CreateBranchData {
  hospital: Types.ObjectId;
  name: string;
  code: string;
  branchType: "main" | "satellite" | "dispensary" | "clinic" | "pharmacy";
  address: IBranchAddress;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  operatingHours: IOperatingHours;
  bedsCount?: number;
  medicineStorageCapacity?: number;
  refrigeratorCapacity?: number;
}

export function findById(id: string | Types.ObjectId) {
  return Branch.findById(id);
}

export function findByCode(code: string) {
  return Branch.findOne({ code: code.toUpperCase() });
}

export function createBranch(data: CreateBranchData) {
  return Branch.create(data);
}

export function saveBranch(branch: IBranch) {
  return branch.save();
}

export async function listByHospital(
  hospitalId: string | Types.ObjectId,
  page: number,
  limit: number
): Promise<{ items: IBranch[]; total: number }> {
  const query = { hospital: hospitalId };
  const [items, total] = await Promise.all([
    Branch.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Branch.countDocuments(query),
  ]);
  return { items, total };
}
