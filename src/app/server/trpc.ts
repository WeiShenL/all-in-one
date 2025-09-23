import { initTRPC } from '@trpc/server';

// Infer the context type from what you return in createContext
// immprotant for trpc to connect with db/prisma
export type Context = {
  prisma: typeof import('@/app/lib/prisma').prisma;
};

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create(); // from dependecy installed

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure; // public is used to avoid confusion between other procedures
