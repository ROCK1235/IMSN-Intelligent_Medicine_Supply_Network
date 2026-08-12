import { IManufacturer } from "../model/manufacturers.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { MANUFACTURER_MESSAGES } from "../../../constants/messages";
import * as manufacturerRepository from "../repository/manufacturer.repository";
import {
  CreateManufacturerInput,
  UpdateManufacturerInput,
} from "../validator/manufacturer.validator";

export async function createManufacturer(
  input: CreateManufacturerInput
): Promise<IManufacturer> {
  const [byName, byLicense, byEmail] = await Promise.all([
    manufacturerRepository.findByName(input.name),
    manufacturerRepository.findByLicenseNumber(input.licenseNumber),
    manufacturerRepository.findByEmail(input.email),
  ]);

  if (byName) throw new AppError(HTTP_STATUS.CONFLICT, MANUFACTURER_MESSAGES.DUPLICATE_NAME);
  if (byLicense) {
    throw new AppError(HTTP_STATUS.CONFLICT, MANUFACTURER_MESSAGES.DUPLICATE_LICENSE_NUMBER);
  }
  if (byEmail) throw new AppError(HTTP_STATUS.CONFLICT, MANUFACTURER_MESSAGES.DUPLICATE_EMAIL);

  return manufacturerRepository.createManufacturer({
    ...input,
    address: { ...input.address, country: input.address.country ?? "India" },
  });
}

export async function getManufacturerById(id: string): Promise<IManufacturer> {
  const manufacturer = await manufacturerRepository.findById(id);
  if (!manufacturer) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MANUFACTURER_MESSAGES.NOT_FOUND);
  }
  return manufacturer;
}

export async function listManufacturers(
  filter: { isActive?: boolean },
  page: number,
  limit: number
) {
  return manufacturerRepository.list(filter, page, limit);
}

export async function updateManufacturer(
  id: string,
  input: UpdateManufacturerInput
): Promise<IManufacturer> {
  const manufacturer = await getManufacturerById(id);

  if (input.email && input.email !== manufacturer.email) {
    const existing = await manufacturerRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(HTTP_STATUS.CONFLICT, MANUFACTURER_MESSAGES.DUPLICATE_EMAIL);
    }
  }

  const { address, ...rest } = input;
  Object.assign(manufacturer, rest);
  if (address) Object.assign(manufacturer.address, address);

  await manufacturerRepository.saveManufacturer(manufacturer);
  return manufacturer;
}

export async function deactivateManufacturer(id: string): Promise<IManufacturer> {
  const manufacturer = await getManufacturerById(id);
  manufacturer.isActive = false;
  await manufacturerRepository.saveManufacturer(manufacturer);
  return manufacturer;
}
