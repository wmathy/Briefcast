import { spawnSync } from "node:child_process";
import path from "node:path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const url = process.env.DATABASE_URL?.trim() ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

if (process.env.VERCEL && !isPostgres) {
  console.error(
    "Vercel requires DATABASE_URL to be a hosted Postgres URL (Neon or any Postgres).\n" +
      "SQLite under /tmp is not shared across serverless instances, so Follow writes a show that the next /shows/[id] request cannot see.",
  );
  process.exit(1);
}

if (!url) {
  process.env.DATABASE_URL = `file:${dbPath}`;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "db", "push"]);
run("npx", ["tsx", "prisma/seed.ts"]);
