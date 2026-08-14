import { Medicine } from "../../medicine/model/medicine.model";

/**
 * Minimal read-only access to Medicine, scoped to what
 * exchangeRequest.service.ts needs when validating exchange items.
 */
export function findById(id: string) {
  return Medicine.findById(id);
}
