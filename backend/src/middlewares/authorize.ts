import { NextFunction, Request, Response } from "express";
import { Role } from "../modules/roles/model/roles.model";
// Side-effect import: registers the "Permission" model with Mongoose so
// `.populate("permissions")` below can resolve it. Required even though this
// file only needs the IPermission *type* — without it, `authorize` only
// works by accident, depending on some other module having already
// imported Permission first (see MEMORY.md).
import "../modules/permissions/model/permissions.model";
import type { IPermission } from "../modules/permissions/model/permissions.model";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../constants/http";
import { AUTH_MESSAGES } from "../constants/messages";
import { PermissionName } from "../constants/permissions";

/**
 * Requires the caller's role to hold ALL of the given permissions.
 * Must run after `protect` (needs req.user.role). Loads the role fresh on
 * every call rather than trusting the JWT, so permission changes take
 * effect immediately without waiting for token expiry.
 *
 * NOTE: this checks "does the role have this permission at all" — it does
 * not evaluate the permission's `scope` (own/own_hospital/all). Scope-level
 * enforcement (e.g. "only within my own hospital") is a separate concern,
 * handled by middlewares/hospitalScope.ts / utils/authorization.ts. See
 * DESIGN.md §5 for why these are kept independent.
 */
export function authorize(...requiredPermissions: PermissionName[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, AUTH_MESSAGES.AUTH_REQUIRED);
      }

      const role = await Role.findOne({
        name: req.user.role,
        isActive: true,
      }).populate<{ permissions: IPermission[] }>("permissions");

      if (!role) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.INSUFFICIENT_PERMISSIONS);
      }

      const granted = new Set(
        role.permissions
          .filter((permission) => permission.isActive)
          .map((permission) => permission.name)
      );

      const hasAll = requiredPermissions.every((permission) => granted.has(permission));
      if (!hasAll) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, AUTH_MESSAGES.INSUFFICIENT_PERMISSIONS);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
