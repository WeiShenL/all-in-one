// this is our app router

// routes are imported here from server/router/ .ts
import { trpcRouteSampleRouter } from './trpcRouteSample';

import { commentsRouter } from './comment';

// here we import from our init (server/trpc.ts)
import { router } from '../trpc';

// remember to export so that it is callable in api/trpc/[trpc]/routes.ts
export const appRouter = router({
  // ... here is where our routes are defined

  // name it so that it is easier and neater to call. Basically without router
  trpcRouteSample: trpcRouteSampleRouter,
  comments: commentsRouter, // placeholder for test
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
