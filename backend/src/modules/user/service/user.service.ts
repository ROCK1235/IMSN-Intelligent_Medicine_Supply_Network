import { Types } from "mongoose";
import { IUser } from "../model/User.model";
import { SYSTEM_ROLES } from "../../roles/model/roles.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { AUTH_MESSAGES } from "../../../constants/messages";
import {getRefreshTokenExpiry,signAccessToken,signRefreshToken,verifyRefreshToken,} from "../../../utils/jwt";
import { hashToken } from "../../../utils/token";
import { RegisterInput, LoginInput } from "../validator/user.validator";
import * as userRepository from "../repository/user.repository";
import * as refreshTokenRepository from "../repository/refreshToken.repository";
import * as roleRepository from "../repository/role.repository";

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  hospital?: string;
  branch?: string;
  isEmailVerified: boolean;
}

export async function register(
  input: RegisterInput,
  meta: RequestMeta
): Promise<{ user: SafeUser } & AuthTokens> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new AppError(HTTP_STATUS.CONFLICT, AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED);
  }

  const roleName = input.role ?? SYSTEM_ROLES.VIEWER;
  const role = await roleRepository.findActiveRoleByName(roleName);
  if (!role) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      AUTH_MESSAGES.ROLE_NOT_AVAILABLE
    );
  }

  const user = await userRepository.createUser({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: input.password,
    phoneNumber: input.phoneNumber,
    role: role._id,
    hospital: input.hospitalId ? new Types.ObjectId(input.hospitalId) : undefined,
    branch: input.branchId ? new Types.ObjectId(input.branchId) : undefined,
  });

  const tokens = await issueTokens(user, role.name, meta);
  return { user: toSafeUser(user, role.name), ...tokens };
}

export async function login(
  input: LoginInput,
  meta: RequestMeta
): Promise<{ user: SafeUser } & AuthTokens> {
  const user = await userRepository.findByEmailWithPassword(input.email);
  if (!user) {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  if (!user.isActive) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.ACCOUNT_DEACTIVATED);
  }

  if (user.isAccountLocked()) {
    throw new AppError(HTTP_STATUS.LOCKED, AUTH_MESSAGES.ACCOUNT_LOCKED);
  }

  const passwordMatches = await user.comparePassword(input.password);
  if (!passwordMatches) {
    await registerFailedAttempt(user);
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.INVALID_CREDENTIALS);
  }

  user.loginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  user.loginHistory.push({
    timestamp: new Date(),
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  if (user.loginHistory.length > 10) {
    user.loginHistory = user.loginHistory.slice(-10);
  }
  await userRepository.saveUser(user);

  const role = await roleRepository.findRoleById(user.role);
  const tokens = await issueTokens(user, role?.name ?? "", meta);
  return { user: toSafeUser(user, role?.name ?? ""), ...tokens };
}

export async function refresh(
  refreshTokenJwt: string | undefined,
  meta: RequestMeta
): Promise<AuthTokens> {
  if (!refreshTokenJwt) {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.REFRESH_TOKEN_REQUIRED);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenJwt);
  } catch {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
  }

  const hashed = hashToken(refreshTokenJwt);
  const stored = await refreshTokenRepository.findByHashedToken(hashed);
  if (!stored || stored.isRevoked || stored.expiresAt <= new Date()) {
    throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
  }

  const user = await userRepository.findActiveById(payload.userId);
  if (!user) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      AUTH_MESSAGES.USER_NOT_FOUND_OR_INACTIVE
    );
  }

  // Rotate: revoke the used refresh token and issue a fresh pair.
  stored.isRevoked = true;
  stored.revokedAt = new Date();
  await stored.save();

  const role = await roleRepository.findRoleById(user.role);
  return issueTokens(user, role?.name ?? "", meta);
}

export async function logout(refreshTokenJwt: string | undefined): Promise<void> {
  if (!refreshTokenJwt) return;

  const hashed = hashToken(refreshTokenJwt);
  await refreshTokenRepository.revokeToken(hashed);
}

async function registerFailedAttempt(user: IUser): Promise<void> {
  user.loginAttempts += 1;
  if (user.loginAttempts >= 5) {
    user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  await userRepository.saveUser(user);
}

async function issueTokens(
  user: IUser,
  roleName: string,
  meta: RequestMeta
): Promise<AuthTokens> {
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: roleName,
    hospital: user.hospital?.toString(),
    branch: user.branch?.toString(),
  });

  const refreshTokenJwt = signRefreshToken({ userId: user._id.toString() });

  await refreshTokenRepository.createRefreshToken({
    token: hashToken(refreshTokenJwt),
    user: user._id,
    expiresAt: getRefreshTokenExpiry(),
    ipAddress: meta.ipAddress || "unknown",
    userAgent: meta.userAgent || "unknown",
  });

  return { accessToken, refreshToken: refreshTokenJwt };
}

function toSafeUser(user: IUser, roleName: string): SafeUser {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: roleName,
    hospital: user.hospital?.toString(),
    branch: user.branch?.toString(),
    isEmailVerified: user.isEmailVerified,
  };
}
