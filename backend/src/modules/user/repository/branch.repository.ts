import { Branch } from "../../branches/model/branches.model";

/**
 * Minimal read-only access to Branch, scoped to what staff.service.ts needs
 * when validating a pharmacist invite's branchId belongs to the hospital.
 */
export function findById(id: string) {
  return Branch.findById(id);
}
