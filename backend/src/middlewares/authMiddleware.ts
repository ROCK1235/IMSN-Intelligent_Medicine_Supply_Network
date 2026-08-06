import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../constants/http";
import { AUTH_MESSAGES } from "../constants/messages";
import { User } from "../modules/user/model/User.model";

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

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive || user.deletedAt) {
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
