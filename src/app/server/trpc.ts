import { initTRPC, TRPCError } from '@trpc/server';
import type { User } from '@supabase/supabase-js';
import { prisma } from '@/app/lib/prisma';

// Infer the context type from what you return in createContext
// immprotant for trpc to connect with db/prisma
export type Context = {
  prisma: typeof import('@/app/lib/prisma').prisma;
  userId?: string; // Add the logged-in user's ID
  session?: {
    user: User;
  } | null;
};

/**
 * Create inner tRPC context for testing
 * Used by integration tests to create mock contexts
 */
export function createInnerTRPCContext(opts?: {
  session?: { user: { id: string }; expires: string } | null;
}): Context {
  return {
    prisma,
    userId: opts?.session?.user?.id,
    session: opts?.session
      ? {
          user: {
            id: opts.session.user.id,
            email: '',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          } as User,
        }
      : null,
  };
}

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create(); // from dependecy installed

/**
 * Middleware to check for an authenticated user
 * Throws UNAUTHORIZED error if no session is found
 */
const isAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({
    ctx: {
      // Pass the session down to the procedure's context
      session: { ...ctx.session, user: ctx.session.user },
      prisma: ctx.prisma,
    },
  });
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure; // public is used to avoid confusion between other procedures
export const protectedProcedure = t.procedure.use(isAuth); // protected procedure that requires authentication
