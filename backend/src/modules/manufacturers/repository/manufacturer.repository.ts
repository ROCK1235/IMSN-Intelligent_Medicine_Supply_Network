import { Types } from "mongoose";
import { Manufacturer, IManufacturer, IAddress } from "../model/manufacturers.model";

export interface CreateManufacturerData {
  name: string;
  licenseNumber: string;
  registrationDate: Date;
  email: string;
  phoneNumber: string;
  address: IAddress;
  certifications?: string[];
}

export function findById(id: string | Types.ObjectId) {
  return Manufacturer.findById(id);
}

export function findByName(name: string) {
  return Manufacturer.findOne({ name });
}

export function findByLicenseNumber(licenseNumber: string) {
  return Manufacturer.findOne({ licenseNumber });
}

export function findByEmail(email: string) {
  return Manufacturer.findOne({ email });
}

export function createManufacturer(data: CreateManufacturerData) {
  return Manufacturer.create(data);
}

export function saveManufacturer(manufacturer: IManufacturer) {
  return manufacturer.save();
}

export async function list(
  filter: { isActive?: boolean },
  page: number,
  limit: number
): Promise<{ items: IManufacturer[]; total: number }> {
  const query: Record<string, unknown> = {};
  if (filter.isActive !== undefined) query.isActive = filter.isActive;

  const [items, total] = await Promise.all([
    Manufacturer.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Manufacturer.countDocuments(query),
  ]);
  return { items, total };
}
