import { Hospital } from "../../hospitals/model/hospitals.model";

/**
 * Minimal read-only access to Hospital, scoped to what user.service.ts
 * needs when validating a hospital-manager self-registration.
 */
export function findById(id: string) {
  return Hospital.findById(id);
}
