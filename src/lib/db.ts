import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { sqliteFilePath, sqliteUrl } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function prepareSqliteFile() {
  const dest = sqliteFilePath();
  mkdirSync(path.dirname(dest), { recursive: true });
  const bundled = path.join(process.cwd(), "prisma", "dev.db");
  if (process.env.VERCEL && dest !== bundled && !existsSync(dest) && existsSync(bundled)) {
    copyFileSync(bundled, dest);
  }
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  prepareSqliteFile();
  const adapter = new PrismaBetterSqlite3({ url: sqliteUrl() });
  const prisma = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }
  return prisma;
}
