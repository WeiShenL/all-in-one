// note parent folder here is [trpc] so that the route is dynamic. Dont need to do anyting just letting you know so that it is not changed

// this is the handler for API URL

import { appRouter } from '@/app/server/routers/_app';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
// this is improtant to connect with prisma
import { prisma } from '@/app/lib/prisma';
import { createClient } from '@/lib/supabase/server';

const handler = async (req: Request) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    router: appRouter,
    req,
    createContext: async () => {
      // Get the authenticated user from Supabase (secure method)
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Build session object from authenticated user data
      const session = user ? { user } : null;

      return {
        prisma,
        userId: user?.id,
        session,
      };
    },
  });
};

export { handler as GET, handler as POST };
