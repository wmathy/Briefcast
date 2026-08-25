import { spawnSync } from "node:child_process";
import path from "node:path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
process.env.DATABASE_URL ??= `file:${dbPath}`;

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);
run("npx", ["prisma", "db", "push"]);
run("npx", ["tsx", "prisma/seed.ts"]);
