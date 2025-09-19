// note parent folder here is [trpc] so that the route is dynamic. Dont need to do anyting just letting you know so that it is not changed

// this is the handler for API URL

import { appRouter } from "@/app/server/routers/_app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) => {
    return fetchRequestHandler({
        endpoint: "/api/trpc",
        router: appRouter,
        req,
        createContext: () => ({}),
    });
};

export {handler as GET, handler as POST};


