import type { AuthUser } from '@/lib/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
