import { Hospital } from "../../hospitals/model/hospitals.model";

/**
 * Minimal read-only access to Hospital, scoped to what
 * exchangeRequest.service.ts needs when validating request participants.
 */
export function findById(id: string) {
  return Hospital.findById(id);
}
