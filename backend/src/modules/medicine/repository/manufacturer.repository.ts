import { Manufacturer } from "../../manufacturers/model/manufacturers.model";

/**
 * Minimal read-only access to Manufacturer, scoped to what
 * medicine.service.ts needs when validating a medicine's manufacturer.
 */
export function findById(id: string) {
  return Manufacturer.findById(id);
}
