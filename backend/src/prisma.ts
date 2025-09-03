import { PrismaClient } from '@prisma/client';

// Reuse Prisma client in dev to avoid exhausting connections on HMR
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
    globalForPrisma.prisma ?? new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
