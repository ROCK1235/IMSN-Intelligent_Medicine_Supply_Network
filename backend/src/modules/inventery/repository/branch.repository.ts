import { Branch } from "../../branches/model/branches.model";

/**
 * Minimal read-only access to Branch, scoped to what
 * inventory.service.ts needs when validating a branch belongs to a hospital.
 */
export function findById(id: string) {
  return Branch.findById(id);
}
