import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrl, isPostgresDatabaseUrl, sqliteFilePath, sqliteUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function bundledSeedPaths(): string[] {
  return [
    path.join(process.cwd(), "prisma", "seed.db"),
    path.join(process.cwd(), "prisma", "dev.db"),
    path.join(process.cwd(), "src", "data", "briefcast.seed.db"),
  ];
}

export function findBundledSeed(): string | null {
  return bundledSeedPaths().find((candidate) => existsSync(candidate)) ?? null;
}

function prepareSqliteFile() {
  const dest = sqliteFilePath();
  mkdirSync(path.dirname(dest), { recursive: true });
  const seed = findBundledSeed();
  if (seed && path.resolve(dest) !== path.resolve(seed) && !existsSync(dest)) {
    copyFileSync(seed, dest);
  }
}

export function createPrismaClient(): PrismaClient {
  const url = databaseUrl();
  if (isPostgresDatabaseUrl(url)) {
    const adapter = new PrismaPg(url);
    return new PrismaClient({ adapter });
  }
  prepareSqliteFile();
  const adapter = new PrismaLibSql({ url: sqliteUrl() });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  const prisma = createPrismaClient();
  globalForPrisma.prisma = prisma;
  return prisma;
}
