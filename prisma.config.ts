import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

const defaultUrl = `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const url = process.env.DATABASE_URL?.trim() || defaultUrl;
const provider = /^postgres(ql)?:\/\//i.test(url) ? "postgresql" : "sqlite";

const sourcePath = path.join(process.cwd(), "prisma", "schema.prisma");
const activePath = path.join(process.cwd(), "prisma", "schema.active.prisma");
const source = readFileSync(sourcePath, "utf8");
const active = source.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`);
writeFileSync(activePath, active);

export default defineConfig({
  schema: "prisma/schema.active.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url,
  },
});
