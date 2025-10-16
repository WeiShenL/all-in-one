// this is our app router

// routes are imported here from server/router/ .ts
import { departmentRouter } from './department';
import { userProfileRouter } from './userProfile';
import { taskFileRouter } from './taskFile';
import { projectRouter } from './project';

import { notificationRouter } from './notification';
import { taskRouter } from './task';

// here we import from our init (server/trpc.ts)
import { router } from '../trpc';

// remember to export so that it is callable in api/trpc/[trpc]/routes.ts
export const appRouter = router({
  department: departmentRouter,
  userProfile: userProfileRouter,
  taskFile: taskFileRouter,
  project: projectRouter,
  notification: notificationRouter,
  task: taskRouter,
});

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter;
