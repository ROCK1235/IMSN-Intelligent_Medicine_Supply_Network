import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../constants/http";
import { AUTH_MESSAGES } from "../constants/messages";
import { isAdminRole } from "../utils/authorization";

/**
 * Requires the caller to be a System Admin, or for `req.params[paramName]`
 * to match `req.user.hospital`. Use on any route shaped like
 * `/hospitals/:hospitalId/...`. Must run after `protect`.
 *
 * For routes where the hospital id isn't in the URL (e.g. it's on a loaded
 * document instead), use `utils/authorization.ts#assertSameHospital` in the
 * service layer instead — see ARCHITECTURE.md §6.
 */
export function requireHospitalMatch(paramName = "hospitalId") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.AUTH_REQUIRED));
      return;
    }

    if (isAdminRole(req.user.role)) {
      next();
      return;
    }

    const requestedHospitalId = req.params[paramName];
    if (!req.user.hospital || req.user.hospital !== requestedHospitalId) {
      next(new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.HOSPITAL_MISMATCH));
      return;
    }

    next();
  };
}
