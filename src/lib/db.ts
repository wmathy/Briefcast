import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { sqliteFilePath, sqliteUrl } from "@/lib/env";

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

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  prepareSqliteFile();
  const adapter = new PrismaLibSql({ url: sqliteUrl() });
  const prisma = new PrismaClient({ adapter });
  globalForPrisma.prisma = prisma;
  return prisma;
}
