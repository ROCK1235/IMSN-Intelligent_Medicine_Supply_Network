import { Request } from "express";
import { AppError } from "./AppError";
import { HTTP_STATUS } from "../constants/http";

/**
 * Reads a route param as a plain string. Express 5's param values are typed
 * `string | string[]` (path-to-regexp now supports repeated-segment
 * params), so every `req.params.x` read needs to either narrow or reject
 * the array case — do it once here instead of casting at every call site.
 */
export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, `Invalid or missing "${name}" parameter`);
  }
  return value;
}
