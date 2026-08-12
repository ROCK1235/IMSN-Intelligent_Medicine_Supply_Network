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

/**
 * Validates req.query against a Zod schema (useful for pagination/filter
 * params — see DESIGN.md §2.2). Merges the parsed/coerced result into the
 * existing req.query object rather than reassigning it, since Express 5's
 * req.query is a getter and a plain `req.query = ...` isn't safe to rely on.
 * Read the coerced values back out via `req.query as unknown as InferredType`
 * in the controller.
 */
export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(result.error);
      return;
    }

    Object.assign(req.query, result.data);
    next();
  };
}
