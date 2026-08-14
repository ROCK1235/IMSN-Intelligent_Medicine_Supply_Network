import { Types } from "mongoose";
import { IBranch } from "../model/branches.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { BRANCH_MESSAGES } from "../../../constants/messages";
import { assertSameHospital } from "../../../utils/authorization";
import * as branchRepository from "../repository/branch.repository";
import * as hospitalRepository from "../../hospitals/repository/hospital.repository";
import { CreateBranchInput, UpdateBranchInput } from "../validator/branch.validator";

export interface Actor {
  role: string;
  hospital?: string;
}

export async function createBranch(
  actor: Actor,
  hospitalId: string,
  input: CreateBranchInput
): Promise<IBranch> {
  assertSameHospital(actor, hospitalId);

  const hospital = await hospitalRepository.findById(hospitalId);
  if (!hospital || !hospital.isActive) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, BRANCH_MESSAGES.HOSPITAL_INACTIVE);
  }

  const existingCode = await branchRepository.findByCode(input.code);
  if (existingCode) {
    throw new AppError(HTTP_STATUS.CONFLICT, BRANCH_MESSAGES.DUPLICATE_CODE);
  }

  const branch = await branchRepository.createBranch({
    ...input,
    address: { ...input.address, country: input.address.country ?? "India" },
    hospital: hospital._id,
  });
  await hospitalRepository.incrementBranchCount(hospital._id, 1);
  return branch;
}

// Deliberately no assertSameHospital here — branch reads are open to any
// authenticated user (see branch.route.ts). Mutations stay hospital-scoped
// via the route-level requireHospitalMatch that runs before these are ever
// reached from updateBranch/deactivateBranch below.
export async function listBranches(hospitalId: string, page: number, limit: number) {
  return branchRepository.listByHospital(hospitalId, page, limit);
}

export async function getBranch(hospitalId: string, branchId: string): Promise<IBranch> {
  const branch = await branchRepository.findById(branchId);
  if (!branch || branch.hospital.toString() !== hospitalId) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, BRANCH_MESSAGES.NOT_FOUND);
  }
  return branch;
}

export async function updateBranch(
  hospitalId: string,
  branchId: string,
  input: UpdateBranchInput
): Promise<IBranch> {
  const branch = await getBranch(hospitalId, branchId);

  const { address, operatingHours, ...rest } = input;
  Object.assign(branch, rest);
  if (address) Object.assign(branch.address, address);
  if (operatingHours) Object.assign(branch.operatingHours, operatingHours);

  await branchRepository.saveBranch(branch);
  return branch;
}

export async function deactivateBranch(hospitalId: string, branchId: string): Promise<IBranch> {
  const branch = await getBranch(hospitalId, branchId);

  if (branch.isActive) {
    branch.isActive = false;
    await branchRepository.saveBranch(branch);
    await hospitalRepository.incrementBranchCount(new Types.ObjectId(hospitalId), -1);
  }

  return branch;
}
