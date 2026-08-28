import { PrismaClient } from "@prisma/client";

// Prisma client singleton — reused across dev-server hot reloads so we don't
// exhaust database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
