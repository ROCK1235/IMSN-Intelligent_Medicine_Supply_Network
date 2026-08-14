import { IHospital } from "../model/hospitals.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { HOSPITAL_MESSAGES } from "../../../constants/messages";
import { assertSameHospital, isAdminRole } from "../../../utils/authorization";
import * as hospitalRepository from "../repository/hospital.repository";
import { RegisterHospitalInput, UpdateHospitalInput } from "../validator/hospital.validator";

export interface Actor {
  role: string;
  hospital?: string;
}

export async function registerHospital(input: RegisterHospitalInput): Promise<IHospital> {
  const [byEmail, byRegistration, byLicense, byTax] = await Promise.all([
    hospitalRepository.findByEmail(input.email),
    hospitalRepository.findByRegistrationNumber(input.registrationNumber),
    hospitalRepository.findByLicenseNumber(input.licenseNumber),
    hospitalRepository.findByTaxId(input.taxId),
  ]);

  if (byEmail) {
    throw new AppError(HTTP_STATUS.CONFLICT, HOSPITAL_MESSAGES.DUPLICATE_EMAIL);
  }
  if (byRegistration) {
    throw new AppError(HTTP_STATUS.CONFLICT, HOSPITAL_MESSAGES.DUPLICATE_REGISTRATION_NUMBER);
  }
  if (byLicense) {
    throw new AppError(HTTP_STATUS.CONFLICT, HOSPITAL_MESSAGES.DUPLICATE_LICENSE_NUMBER);
  }
  if (byTax) {
    throw new AppError(HTTP_STATUS.CONFLICT, HOSPITAL_MESSAGES.DUPLICATE_TAX_ID);
  }

  return hospitalRepository.createHospital({
    ...input,
    address: { ...input.address, country: input.address.country ?? "India" },
  });
}

export async function getHospitalById(hospitalId: string): Promise<IHospital> {
  const hospital = await hospitalRepository.findById(hospitalId);
  if (!hospital) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, HOSPITAL_MESSAGES.NOT_FOUND);
  }
  return hospital;
}

/**
 * Admins get the raw `?verified=` filter they need for the verification
 * workflow (including seeing unverified hospitals). Everyone else can only
 * browse the public verified+active directory — e.g. to pick a recipient
 * hospital when creating an exchange request — never unverified ones.
 */
export async function listHospitals(
  actor: Actor,
  verifiedFilter: boolean | undefined,
  page: number,
  limit: number
) {
  const filter = isAdminRole(actor.role)
    ? { isVerified: verifiedFilter }
    : { isVerified: true, isActive: true };
  return hospitalRepository.list(filter, page, limit);
}

export async function verifyHospital(hospitalId: string): Promise<IHospital> {
  const hospital = await getHospitalById(hospitalId);
  if (hospital.isVerified) {
    throw new AppError(HTTP_STATUS.CONFLICT, HOSPITAL_MESSAGES.ALREADY_VERIFIED);
  }

  hospital.isVerified = true;
  hospital.verificationDate = new Date();
  await hospitalRepository.saveHospital(hospital);
  return hospital;
}

export async function deactivateHospital(hospitalId: string): Promise<IHospital> {
  const hospital = await getHospitalById(hospitalId);
  hospital.isActive = false;
  await hospitalRepository.saveHospital(hospital);
  return hospital;
}

export async function updateHospital(
  actor: Actor,
  hospitalId: string,
  input: UpdateHospitalInput
): Promise<IHospital> {
  const hospital = await getHospitalById(hospitalId);
  assertSameHospital(actor, hospital._id);

  const { address, ...rest } = input;
  Object.assign(hospital, rest);
  if (address) {
    Object.assign(hospital.address, address);
  }

  await hospitalRepository.saveHospital(hospital);
  return hospital;
}
