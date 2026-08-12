import { Types } from "mongoose";
import { Role } from "../../roles/model/roles.model";

/**
 * Role data-access, scoped to what the user module needs when assigning a
 * role at registration / resolving a user's role name for tokens.
 */

export function findActiveRoleByName(name: string) {
  return Role.findOne({ name, isActive: true });
}

export function findRoleById(id: Types.ObjectId) {
  return Role.findById(id);
}

export function findRolesByIds(ids: Types.ObjectId[]) {
  return Role.find({ _id: { $in: ids } });
}
