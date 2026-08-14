import { Types } from "mongoose";
import { User } from "../../user/model/User.model";
import { Role, SYSTEM_ROLES } from "../../roles/model/roles.model";

/**
 * Minimal read-only access to User, scoped to what
 * exchangeRequest.service.ts needs to find who to notify at a hospital.
 */
export async function findHospitalManagers(hospitalId: string | Types.ObjectId) {
  const role = await Role.findOne({ name: SYSTEM_ROLES.HOSPITAL_MANAGER, isActive: true });
  if (!role) return [];
  return User.find({ hospital: hospitalId, role: role._id, isActive: true, deletedAt: null });
}
