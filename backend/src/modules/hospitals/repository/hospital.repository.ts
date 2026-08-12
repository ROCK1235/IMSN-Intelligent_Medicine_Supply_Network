import { Types } from "mongoose";
import { Hospital, IHospital, IHospitalAddress } from "../model/hospitals.model";

export interface CreateHospitalData {
  name: string;
  registrationNumber: string;
  licenseNumber: string;
  organizationType: "government" | "private" | "ngo" | "research" | "teaching";
  email: string;
  phoneNumber: string;
  website?: string;
  address: IHospitalAddress;
  bedsCount: number;
  specializations?: string[];
  accreditations?: string[];
  taxId: string;
  paymentTerms?: string;
}

export interface ListFilter {
  isVerified?: boolean;
  isActive?: boolean;
}

export function findById(id: string | Types.ObjectId) {
  return Hospital.findById(id);
}

export function findByEmail(email: string) {
  return Hospital.findOne({ email });
}

export function findByRegistrationNumber(registrationNumber: string) {
  return Hospital.findOne({ registrationNumber });
}

export function findByLicenseNumber(licenseNumber: string) {
  return Hospital.findOne({ licenseNumber });
}

export function findByTaxId(taxId: string) {
  return Hospital.findOne({ taxId });
}

export function createHospital(data: CreateHospitalData) {
  return Hospital.create(data);
}

export function saveHospital(hospital: IHospital) {
  return hospital.save();
}

export async function list(
  filter: ListFilter,
  page: number,
  limit: number
): Promise<{ items: IHospital[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.isVerified !== undefined) query.isVerified = filter.isVerified;
  if (filter.isActive !== undefined) query.isActive = filter.isActive;

  const [items, total] = await Promise.all([
    Hospital.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Hospital.countDocuments(query),
  ]);

  return { items, total };
}

export function incrementBranchCount(hospitalId: Types.ObjectId, delta: number) {
  return Hospital.updateOne({ _id: hospitalId }, { $inc: { totalBranches: delta } });
}
