import { Types } from "mongoose";
import { User, IUser } from "../model/User.model";

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role: Types.ObjectId;
  hospital?: Types.ObjectId;
  branch?: Types.ObjectId;
}

/**
 * User data-access layer. Contains only query/persistence logic — no
 * business rules (those live in the service layer).
 */

export function findByEmail(email: string) {
  return User.findOne({ email });
}

/**
 * Find a non-deleted user by email with the password field included
 * (password is `select: false` on the schema by default). Used for login.
 */
export function findByEmailWithPassword(email: string) {
  return User.findOne({ email, deletedAt: null }).select("+password");
}

export function findById(id: string | Types.ObjectId) {
  return User.findById(id);
}

export function findActiveById(id: string | Types.ObjectId) {
  return User.findOne({ _id: id, isActive: true, deletedAt: null });
}

/**
 * Like findById, but excludes soft-deleted users — use this instead of a
 * bare findById + checking `.deletedAt` on the result, since `deletedAt` is
 * `select: false` and would always read as undefined on a fetched document.
 * Unlike findActiveById, this does NOT filter on isActive (useful when the
 * caller needs to load a currently-deactivated user, e.g. to reactivate them).
 */
export function findByIdExcludingDeleted(id: string | Types.ObjectId) {
  return User.findOne({ _id: id, deletedAt: null });
}

export async function listByHospital(
  hospitalId: string | Types.ObjectId,
  page: number,
  limit: number
): Promise<{ items: IUser[]; total: number }> {
  const query = { hospital: hospitalId, deletedAt: null };
  const [items, total] = await Promise.all([
    User.find(query)
      .sort({ lastName: 1, firstName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);
  return { items, total };
}

/**
 * Find a user by their (hashed) email verification token, provided it
 * hasn't expired. Selects the token/expiry fields since they're
 * `select: false` on the schema by default.
 */
export function findByEmailVerificationTokenHash(hashedToken: string) {
  return User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken +emailVerificationExpires");
}

/**
 * Find a user by their (hashed) password reset token, provided it hasn't
 * expired.
 */
export function findByPasswordResetTokenHash(hashedToken: string) {
  return User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");
}

export function countByHospitalAndRole(
  hospitalId: Types.ObjectId,
  roleId: Types.ObjectId
) {
  return User.countDocuments({ hospital: hospitalId, role: roleId, deletedAt: null });
}

export function createUser(data: CreateUserData) {
  return User.create(data);
}

export function saveUser(user: IUser) {
  return user.save();
}
