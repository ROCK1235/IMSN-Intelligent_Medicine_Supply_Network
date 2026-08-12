import { Medicine } from "../../medicine/model/medicine.model";

/**
 * Minimal read-only access to Medicine, scoped to what
 * inventory.service.ts needs when validating/pricing an inventory batch.
 */
export function findById(id: string) {
  return Medicine.findById(id);
}
