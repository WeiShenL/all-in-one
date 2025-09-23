// communication between client and server usign react query
// client setup/utils
import { createTRPCReact } from '@trpc/react-query';
import { AppRouter } from '../server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
