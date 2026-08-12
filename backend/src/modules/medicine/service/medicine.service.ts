import { Types } from "mongoose";
import { IMedicine } from "../model/medicine.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { MEDICINE_MESSAGES } from "../../../constants/messages";
import * as medicineRepository from "../repository/medicine.repository";
import * as categoryRepository from "../repository/category.repository";
import * as manufacturerRepository from "../repository/manufacturer.repository";
import { CreateMedicineInput, UpdateMedicineInput } from "../validator/medicine.validator";

async function assertCategoryActive(categoryId: string): Promise<void> {
  const category = await categoryRepository.findById(categoryId);
  if (!category || !category.isActive) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, MEDICINE_MESSAGES.CATEGORY_NOT_FOUND);
  }
}

async function assertManufacturerActive(manufacturerId: string): Promise<void> {
  const manufacturer = await manufacturerRepository.findById(manufacturerId);
  if (!manufacturer || !manufacturer.isActive) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, MEDICINE_MESSAGES.MANUFACTURER_NOT_FOUND);
  }
}

export async function createMedicine(input: CreateMedicineInput): Promise<IMedicine> {
  const existing = await medicineRepository.findByRegistrationNumber(input.registrationNumber);
  if (existing) {
    throw new AppError(HTTP_STATUS.CONFLICT, MEDICINE_MESSAGES.DUPLICATE_REGISTRATION_NUMBER);
  }

  await Promise.all([
    assertCategoryActive(input.category),
    assertManufacturerActive(input.manufacturer),
  ]);

  return medicineRepository.createMedicine({
    ...input,
    category: new Types.ObjectId(input.category),
    manufacturer: new Types.ObjectId(input.manufacturer),
  });
}

export async function getMedicineById(id: string): Promise<IMedicine> {
  const medicine = await medicineRepository.findById(id);
  if (!medicine) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MEDICINE_MESSAGES.NOT_FOUND);
  }
  return medicine;
}

export async function listMedicines(
  filter: medicineRepository.ListFilter,
  page: number,
  limit: number
) {
  return medicineRepository.list(filter, page, limit);
}

export async function updateMedicine(
  id: string,
  input: UpdateMedicineInput
): Promise<IMedicine> {
  const medicine = await getMedicineById(id);

  if (input.category) await assertCategoryActive(input.category);
  if (input.manufacturer) await assertManufacturerActive(input.manufacturer);

  const { category, manufacturer, ...rest } = input;
  Object.assign(medicine, rest);
  if (category) medicine.category = new Types.ObjectId(category);
  if (manufacturer) medicine.manufacturer = new Types.ObjectId(manufacturer);

  await medicineRepository.saveMedicine(medicine);
  return medicine;
}

export async function discontinueMedicine(id: string): Promise<IMedicine> {
  const medicine = await getMedicineById(id);
  medicine.isActive = false;
  await medicineRepository.saveMedicine(medicine);
  return medicine;
}
