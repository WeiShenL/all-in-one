// communication between client and server that we can reuse
// client setup/utils

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Optimized Prisma client for serverless environments (Vercel)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Connection pool configuration for serverless
    // Supabase pooler will handle connection pooling externally
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown for serverless
if (process.env.VERCEL) {
  // On Vercel, ensure connections are cleaned up
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}
