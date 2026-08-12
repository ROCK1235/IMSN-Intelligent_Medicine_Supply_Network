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
 * params — see DESIGN.md §2.2). Stores the parsed/coerced/defaulted result
 * on req.validatedQuery — NOT back onto req.query, which doesn't work:
 * Express 5's req.query is a getter with no setter that re-parses the raw
 * URL on every access, so anything written onto one snapshot of it (even
 * via Object.assign) is silently discarded on the next read (see MEMORY.md
 * for how this was caught). Controllers must read
 * `req.validatedQuery as InferredType`, not `req.query`.
 */
export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(result.error);
      return;
    }

    req.validatedQuery = result.data;
    next();
  };
}
