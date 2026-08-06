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
    }
  }
}

export {};
