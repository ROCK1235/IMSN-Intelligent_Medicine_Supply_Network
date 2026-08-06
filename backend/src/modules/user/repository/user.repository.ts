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

export function createUser(data: CreateUserData) {
  return User.create(data);
}

export function saveUser(user: IUser) {
  return user.save();
}
