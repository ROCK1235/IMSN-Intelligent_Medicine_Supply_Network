import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../constants/http";
import { AUTH_MESSAGES } from "../constants/messages";
import * as userRepository from "../modules/user/repository/user.repository";

/**
 * Requires a valid access token (Authorization: Bearer <token>).
 * Loads the user, rejects if it no longer exists / is inactive / was
 * soft-deleted, and attaches a minimal profile to req.user.
 */
export async function protect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.AUTH_REQUIRED);
    }

    const payload = verifyAccessToken(token);

    // findActiveById filters { isActive: true, deletedAt: null } in the query
    // itself — deletedAt is `select: false` on the schema, so checking it on
    // a fetched document (rather than in the filter) would always read
    // `undefined` regardless of the real value. See MEMORY.md.
    const user = await userRepository.findActiveById(payload.userId);
    if (!user) {
      throw new AppError(
        HTTP_STATUS.UNAUTHORIZED,
        AUTH_MESSAGES.USER_NOT_FOUND_OR_INACTIVE
      );
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: payload.role,
      hospital: payload.hospital,
      branch: payload.branch,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.TOKEN_INVALID));
  }
}
