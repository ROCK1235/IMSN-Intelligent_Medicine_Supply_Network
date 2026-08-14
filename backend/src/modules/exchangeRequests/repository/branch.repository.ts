import { Branch } from "../../branches/model/branches.model";

/**
 * Minimal read-only access to Branch, scoped to what
 * exchangeRequest.service.ts needs when validating request participants.
 */
export function findById(id: string) {
  return Branch.findById(id);
}
