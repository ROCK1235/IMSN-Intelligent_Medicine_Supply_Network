declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        hospital?: string;
        branch?: string;
      };
      /**
       * Set by middlewares/validate.ts#validateQuery. Express 5's req.query
       * is a getter that re-parses the raw URL on every access (no setter,
       * no caching — see MEMORY.md), so validated/coerced/defaulted query
       * params can't be written back onto req.query itself. Controllers
       * that used validateQuery must read this instead of req.query.
       */
      validatedQuery?: unknown;
    }
  }
}

export {};
