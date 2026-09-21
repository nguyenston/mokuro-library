import { PrismaClient } from '../../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { cacheExtension } from './cacheExtension';
import { statsExtension } from './seriesStatExtension';
import { rebaseQueryExtension } from './rebaseQueryExtension';


export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  const adapter = new PrismaBetterSqlite3(
    { url: databaseUrl },
    { timestampFormat: 'iso8601' }
  );

  const basePrisma = new PrismaClient({ adapter });

  const extendedPrisma = basePrisma
    .$extends(cacheExtension)
    .$extends(statsExtension)
    .$extends(rebaseQueryExtension);
  return extendedPrisma;
}

export const prisma = createPrismaClient();
export type ExtendedPrismaClient = typeof prisma;

declare module 'fastify' {
  interface FastifyInstance {
    prisma: ExtendedPrismaClient;  // Direct reference, same file
  }
}
