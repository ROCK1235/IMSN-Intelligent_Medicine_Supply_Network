import { MedicineCategory } from "../../medicineCategories/model/medicineCategories.model";

/**
 * Minimal read-only access to MedicineCategory, scoped to what
 * medicine.service.ts needs when validating a medicine's category.
 */
export function findById(id: string) {
  return MedicineCategory.findById(id);
}
