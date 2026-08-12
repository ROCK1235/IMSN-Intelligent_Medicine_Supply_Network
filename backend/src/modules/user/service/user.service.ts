import { randomBytes } from "crypto";
import { IUser } from "../model/User.model";
import { SYSTEM_ROLES } from "../../roles/model/roles.model";
import { AppError } from "../../../utils/AppError";
import { HTTP_STATUS } from "../../../constants/http";
import { AUTH_MESSAGES } from "../../../constants/messages";
import {getRefreshTokenExpiry,signAccessToken,signRefreshToken,verifyRefreshToken,} from "../../../utils/jwt";
import { hashToken } from "../../../utils/token";
import { sendMail } from "../../../utils/mails";
import {
  RegisterInput,
  LoginInput,
  UpdateOwnProfileInput,
} from "../validator/user.validator";
import * as userRepository from "../repository/user.repository";
import * as refreshTokenRepository from "../repository/refreshToken.repository";
import * as roleRepository from "../repository/role.repository";
import * as hospitalRepository from "../repository/hospital.repository";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  hospital?: string;
  branch?: string;
  isEmailVerified: boolean;
}

/**
 * Public self-registration: claims the Hospital Manager slot for an
 * already-verified hospital that doesn't have one yet. See the comment on
 * `registerSchema` (user.validator.ts) for why this is deliberately narrow —
 * pharmacist/viewer accounts are created via staff.service.ts#inviteStaff
 * instead, and admin accounts aren't creatable through the HTTP API at all.
 */
export async function register(
  input: RegisterInput,
  meta: RequestMeta
): Promise<{ user: SafeUser } & AuthTokens> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new AppError(HTTP_STATUS.CONFLICT, AUTH_MESSAGES.EMAIL_ALREADY_REGISTERED);
  }

  const hospital = await hospitalRepository.findById(input.hospitalId);
  if (!hospital) {
    throw new AppError(
      HTTP_STATUS.NOT_FOUND,
      AUTH_MESSAGES.HOSPITAL_NOT_FOUND_FOR_REGISTRATION
    );
  }
  if (!hospital.isVerified || !hospital.isActive) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      AUTH_MESSAGES.HOSPITAL_NOT_VERIFIED_FOR_REGISTRATION
    );
  }

  const role = await roleRepository.findActiveRoleByName(SYSTEM_ROLES.HOSPITAL_MANAGER);
  if (!role) {
    throw new AppError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      AUTH_MESSAGES.ROLE_NOT_AVAILABLE
    );
  }

  const existingManagers = await userRepository.countByHospitalAndRole(
    hospital._id,
    role._id
  );
  if (existingManagers > 0) {
    throw new AppError(HTTP_STATUS.CONFLICT, AUTH_MESSAGES.HOSPITAL_ALREADY_HAS_MANAGER);
  }

  const user = await userRepository.createUser({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    password: input.password,
    phoneNumber: input.phoneNumber,
    role: role._id,
    hospital: hospital._id,
  });

  await sendVerificationEmail(user);

  const tokens = await issueTokens(user, role.name, meta);
  return { user: toSafeUser(user, role.name), ...tokens };
}

export async function updateProfile(
  userId: string,
  input: UpdateOwnProfileInput
): Promise<SafeUser> {
  const user = await userRepository.findActiveById(userId);
  if (!user) {
    throw new AppError(
      HTTP_STATUS.UNAUTHORIZED,
      AUTH_MESSAGES.USER_NOT_FOUND_OR_INACTIVE
    );
  }

  Object.assign(user, input);
  await userRepository.saveUser(user);

  const role = await roleRepository.findRoleById(user.role);
  return toSafeUser(user, role?.name ?? "");
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const hashed = hashToken(rawToken);
  const user = await userRepository.findByEmailVerificationTokenHash(hashed);
  if (!user) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      AUTH_MESSAGES.VERIFICATION_TOKEN_INVALID
    );
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await userRepository.saveUser(user);
}

export async function resendVerification(email: string): Promise<void> {
  const user = await userRepository.findByEmail(email);
  // Silently no-op if the account doesn't exist or is already verified —
  // avoids leaking account existence to the caller.
  if (!user || user.isEmailVerified) return;

  await sendVerificationEmail(user);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await userRepository.findByEmail(email);
  if (!user) return; // avoid leaking account existence

  const resetToken = randomBytes(32).toString("hex");
  user.passwordResetToken = hashToken(resetToken);
  user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await userRepository.saveUser(user);

  await sendMail({
    to: user.email,
    subject: "Reset your IMSN password",
    text: `Use this token to reset your password (expires in 1 hour): ${resetToken}`,
  });
}

export async function resetPassword(
  rawToken: string,
  newPassword: string
): Promise<void> {
  const hashed = hashToken(rawToken);
  const user = await userRepository.findByPasswordResetTokenHash(hashed);
  if (!user) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, AUTH_MESSAGES.RESET_TOKEN_INVALID);
  }

  user.password = newPassword; // pre-save hook re-hashes since isModified("password")
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.loginAttempts = 0;
  user.lockedUntil = undefined;
  await userRepository.saveUser(user);

  // Resetting a password should invalidate every existing session.
  await refreshTokenRepository.revokeAllForUser(user._id);
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

async function sendVerificationEmail(user: IUser): Promise<void> {
  const verificationToken = randomBytes(32).toString("hex");
  user.emailVerificationToken = hashToken(verificationToken);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await userRepository.saveUser(user);

  await sendMail({
    to: user.email,
    subject: "Verify your IMSN account",
    text: `Welcome to IMSN. Use this token to verify your email (expires in 24 hours): ${verificationToken}`,
  });
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
    userId: user.userId,
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
