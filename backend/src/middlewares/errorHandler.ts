import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../constants/http";

/**
 * 404 handler for unmatched routes. Must be registered after all routes.
 */
export function notFound(req: Request, res: Response): void {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Global error handler. Must be registered last, after all routes/middleware.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
      .join("; ");
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
    return;
  }

  if (isMongooseValidationError(err)) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message });
    return;
  }

  if (isMongoDuplicateKeyError(err)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    res.status(HTTP_STATUS.CONFLICT).json({
      success: false,
      message: `Duplicate value for ${field}. Please use another value.`,
    });
    return;
  }

  if (isCastError(err)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: `Invalid value for ${err.path}`,
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: "Internal server error",
  });
}

interface MongooseValidationError {
  name: "ValidationError";
  errors: Record<string, { message: string }>;
}

function isMongooseValidationError(
  err: unknown
): err is MongooseValidationError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "ValidationError" &&
    "errors" in err
  );
}

interface MongoDuplicateKeyError {
  code: 11000;
  keyValue?: Record<string, unknown>;
}

function isMongoDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === "object" && err !== null && (err as { code?: number }).code === 11000
  );
}

interface CastError {
  name: "CastError";
  path: string;
}

function isCastError(err: unknown): err is CastError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "CastError"
  );
}
