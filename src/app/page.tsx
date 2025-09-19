"use client";

import { trpc } from "./lib/trpc"; // use client util

export default function Home() {
  const getTrpcSample = trpc.trpcRouteSample.getTrpcSampleUsers.useQuery();
  return (
    <main>
      <h1>All-in-One Project</h1>
      <p>Next.js application with TypeScript, ESLint, and App Router.</p>
      <p>Ready for development!</p>

      <h3>{JSON.stringify(getTrpcSample.data)}</h3>
    </main>
  )
}
