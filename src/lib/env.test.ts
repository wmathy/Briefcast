import { afterEach, describe, expect, it } from "vitest";
import { databaseProvider, databaseUrl, isPostgresDatabaseUrl } from "./env";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("database URL helpers", () => {
  it("treats postgres and postgresql URLs as hosted Postgres", () => {
    expect(isPostgresDatabaseUrl("postgresql://user:pass@host/db")).toBe(true);
    expect(isPostgresDatabaseUrl("postgres://user:pass@host/db")).toBe(true);
    expect(databaseProvider("postgresql://user:pass@host/db")).toBe("postgresql");
  });

  it("keeps file: and unset URLs on SQLite for local dev", () => {
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL;
    expect(isPostgresDatabaseUrl("file:./prisma/dev.db")).toBe(false);
    expect(databaseProvider("file:./prisma/dev.db")).toBe("sqlite");
    expect(databaseUrl().startsWith("file:")).toBe(true);
  });
});
