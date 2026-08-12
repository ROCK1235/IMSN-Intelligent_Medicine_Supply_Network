import { Types } from "mongoose";
import { SYSTEM_ROLES } from "../modules/roles/model/roles.model";
import { AppError } from "./AppError";
import { HTTP_STATUS } from "../constants/http";
import { AUTH_MESSAGES } from "../constants/messages";

/**
 * System Admin is the only role exempt from hospital-scoping checks
 * (see ARCHITECTURE.md §6).
 */
export function isAdminRole(roleName: string | undefined): boolean {
  return roleName === SYSTEM_ROLES.ADMIN;
}

/**
 * Service-layer hospital-scoping check: throws 403 unless the actor is a
 * System Admin or the resource's hospital matches the actor's own hospital.
 * Use this whenever a resource's hospital id comes from a loaded document
 * (as opposed to a route param, which `middlewares/hospitalScope.ts` covers).
 */
export function assertSameHospital(
  actor: { role: string; hospital?: string },
  resourceHospitalId: Types.ObjectId | string | undefined
): void {
  if (isAdminRole(actor.role)) return;

  if (!actor.hospital || !resourceHospitalId) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.HOSPITAL_MISMATCH);
  }

  if (actor.hospital.toString() !== resourceHospitalId.toString()) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.HOSPITAL_MISMATCH);
  }
}
