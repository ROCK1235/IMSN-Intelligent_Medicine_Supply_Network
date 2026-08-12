import { Types } from "mongoose";
import { randomBytes } from "crypto";
import { IUser } from "../model/User.model";
import { SYSTEM_ROLES } from "../../roles/model/roles.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { AUTH_MESSAGES, STAFF_MESSAGES } from "../../../constants/messages";
import { assertSameHospital } from "../../../utils/authorization";
import { hashToken } from "../../../utils/token";
import { sendMail } from "../../../utils/mails";
import * as userRepository from "../repository/user.repository";
import * as roleRepository from "../repository/role.repository";
import * as branchRepository from "../repository/branch.repository";
import { InviteStaffInput, UpdateStaffInput } from "../validator/staff.validator";

export interface Actor {
  role: string;
  hospital?: string;
}

export interface SafeStaffUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  hospital?: string;
  branch?: string;
  isActive: boolean;
}

const PASSWORD_SETUP_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function inviteStaff(
  actor: Actor,
  hospitalId: string,
  input: InviteStaffInput
): Promise<SafeStaffUser> {
  assertSameHospital(actor, hospitalId);

  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new AppError(HTTP_STATUS.CONFLICT, AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED);
  }

  const role = await roleRepository.findActiveRoleByName(input.role);
  if (!role) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      AUTH_MESSAGES.ROLE_NOT_AVAILABLE
    );
  }

  let branchObjectId: Types.ObjectId | undefined;
  if (input.role === "pharmacist") {
    const branch = await branchRepository.findById(input.branchId as string);
    if (!branch || branch.hospital.toString() !== hospitalId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, STAFF_MESSAGES.BRANCH_NOT_IN_HOSPITAL);
    }
    branchObjectId = branch._id;
  }

  // Never-revealed placeholder password — the invitee sets their own via the
  // password-reset token emailed below (see PHASES.md Phase 3 notes on why
  // this reuses the reset-password machinery instead of a bespoke flow).
  const placeholderPassword = randomBytes(24).toString("hex") + "Aa1!";

  const user = await userRepository.createUser({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: placeholderPassword,
    phoneNumber: input.phoneNumber,
    role: role._id,
    hospital: new Types.ObjectId(hospitalId),
    branch: branchObjectId,
  });

  // Being invited by a trusted manager to a known-good email stands in for
  // the usual click-to-verify step.
  user.isEmailVerified = true;

  const setupToken = randomBytes(32).toString("hex");
  user.passwordResetToken = hashToken(setupToken);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_SETUP_TTL_MS);
  await userRepository.saveUser(user);

  await sendMail({
    to: user.email,
    subject: "You've been invited to IMSN",
    text: `You've been added as a ${input.role} on IMSN. Use this token with POST /api/v1/users/reset-password (expires in 1 hour) to set your password: ${setupToken}`,
  });

  return toSafeStaffUser(user, role.name);
}

export async function listStaff(
  actor: Actor,
  hospitalId: string,
  page: number,
  limit: number
): Promise<{ items: SafeStaffUser[]; total: number }> {
  assertSameHospital(actor, hospitalId);

  const { items, total } = await userRepository.listByHospital(hospitalId, page, limit);
  const roles = await roleRepository.findRolesByIds(items.map((u) => u.role));
  const roleNameById = new Map(roles.map((r) => [r._id.toString(), r.name]));

  return {
    items: items.map((u) => toSafeStaffUser(u, roleNameById.get(u.role.toString()) ?? "")),
    total,
  };
}

export async function updateStaff(
  actor: Actor,
  hospitalId: string,
  userId: string,
  input: UpdateStaffInput
): Promise<SafeStaffUser> {
  assertSameHospital(actor, hospitalId);

  const target = await userRepository.findByIdExcludingDeleted(userId);
  if (!target || !target.hospital || target.hospital.toString() !== hospitalId) {
    // Same message whether the user doesn't exist or belongs to another
    // hospital — don't leak cross-hospital account existence.
    throw new AppError(HTTP_STATUS.NOT_FOUND, STAFF_MESSAGES.NOT_FOUND);
  }

  const currentRole = await roleRepository.findRoleById(target.role);
  if (
    currentRole &&
    (currentRole.name === SYSTEM_ROLES.ADMIN ||
      currentRole.name === SYSTEM_ROLES.HOSPITAL_MANAGER)
  ) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, STAFF_MESSAGES.CANNOT_MODIFY_MANAGER);
  }

  let effectiveRoleName = currentRole?.name ?? "";
  if (input.role) {
    const newRole = await roleRepository.findActiveRoleByName(input.role);
    if (!newRole) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        AUTH_MESSAGES.ROLE_NOT_AVAILABLE
      );
    }
    target.role = newRole._id;
    effectiveRoleName = newRole.name;
  }

  if (input.branchId !== undefined) {
    if (effectiveRoleName === "pharmacist") {
      const branch = await branchRepository.findById(input.branchId);
      if (!branch || branch.hospital.toString() !== hospitalId) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, STAFF_MESSAGES.BRANCH_NOT_IN_HOSPITAL);
      }
      target.branch = branch._id;
    } else {
      target.branch = undefined;
    }
  }

  if (input.isActive !== undefined) {
    target.isActive = input.isActive;
  }

  await userRepository.saveUser(target);
  return toSafeStaffUser(target, effectiveRoleName);
}

function toSafeStaffUser(user: IUser, roleName: string): SafeStaffUser {
  return {
    id: user._id.toString(),
    userId: user.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: roleName,
    hospital: user.hospital?.toString(),
    branch: user.branch?.toString(),
    isActive: user.isActive,
  };
}
