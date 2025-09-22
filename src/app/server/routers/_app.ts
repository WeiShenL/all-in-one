// this is our app router

// routes are imported here from server/router/ .ts

// here we import from our init (server/trpc.ts)
import { router } from '../trpc';

// remember to export so that it is callable in api/trpc/[trpc]/routes.ts
export const appRouter = router({
  // ... here is where our routes are defined
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
