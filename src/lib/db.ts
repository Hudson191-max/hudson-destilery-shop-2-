import { PrismaClient } from "@prisma/client";

// Prisma client singleton.
//
// Created LAZILY on first use (not at module import) so that importing this
// module never requires DATABASE_URL to be present. This matters on Vercel:
// `next build` evaluates every route module to collect page data, and a
// module-level `new PrismaClient()` would crash the build whenever
// DATABASE_URL is not configured — e.g. Supabase-backed deploys, which never
// need the local SQLite database at all.
//
// The globalThis cache also keeps one client across dev-server hot reloads
// so we don't exhaust database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
