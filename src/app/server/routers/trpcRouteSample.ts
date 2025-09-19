// this is a route
// it is accessed in AppRouter (server/index.ts)

/*
why is it used?
    - adding all routes under AppRouter can get messy
    - here we create a file under router according to how we want
        - ideally by object logic. e.g. all related to user will be under test
*/



// here we import from our init (server/trpc.ts)
import { router , publicProcedure } from '../trpc';

// remember to import zod if used for defining type wihtin routes
import { z } from 'zod';

// import context (yet to be setup as prisma needs to be setup)



// note the naming here is what we will import to AppRouter. Naming matters for clarity
// remember to export or will not be reachable
export const trpcRouteSampleRouter = router({
    // ... here is where our routes are defined

    /*
    this is a sample. local mockup. actual will use DB
    here we are querying get (R of CRUD)
    NOTE method query
    */
    getTrpcSampleUsers: publicProcedure.query(() =>{
        return [
            {name: 'Shahul', desc:'this is just a placeholder for tRPC test'},
            {name: 'Shahul2', desc:'this is also placeholder for tRPC test'},
        ]
    }),


    /*
    this is a sample. local data mockup. actual will use DB
    here we are mutating meaning (CUD of CRUD)
    NOTE method mutation
    */

    // here we use zod (z) to define what is the type of each input
    addTrpcSampleUsers: publicProcedure.input(z.object({name: z.string, desc: z.string})).mutation((opts) => {

        // note here we did not declare input type but typescript is aware. This is why zod with tRPC is type safe
        const { input } = opts;

        // For example, you would call prisma here to update DB
    })

});


// might seem similar to AppRouter but will not include the last part of instantiating AppRouter