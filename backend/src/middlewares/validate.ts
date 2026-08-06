import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

/**
 * Validates req.body against a Zod schema, replacing it with the parsed
 * (and coerced/trimmed) result on success, or forwarding a ZodError to the
 * global error handler on failure.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(result.error);
      return;
    }

    req.body = result.data;
    next();
  };
}
