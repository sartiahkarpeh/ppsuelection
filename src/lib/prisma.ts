// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // Prevent multiple instances in development
  // @ts-ignore
  var prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  // @ts-ignore
  global.prisma ||
  new PrismaClient({
    log: ['query'], // optional: logs every query
  });

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.prisma = prisma;
}

