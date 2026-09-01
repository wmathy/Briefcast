import { afterEach, describe, expect, it } from "vitest";
import {
  databaseProvider,
  databaseUrl,
  isPostgresDatabaseUrl,
  isRecoveryEnabled,
  recoverySecret,
  recoverySecretMatches,
} from "./env";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalVercel = process.env.VERCEL;
const originalRecoverySecret = process.env.RECOVERY_SECRET;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  if (originalRecoverySecret === undefined) delete process.env.RECOVERY_SECRET;
  else process.env.RECOVERY_SECRET = originalRecoverySecret;
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

describe("recovery secret helpers", () => {
  it("treats missing or blank RECOVERY_SECRET as disabled", () => {
    delete process.env.RECOVERY_SECRET;
    expect(recoverySecret()).toBeNull();
    expect(isRecoveryEnabled()).toBe(false);
    expect(recoverySecretMatches("anything")).toBe(false);

    process.env.RECOVERY_SECRET = "   ";
    expect(recoverySecret()).toBeNull();
    expect(isRecoveryEnabled()).toBe(false);
  });

  it("matches only the configured secret", () => {
    process.env.RECOVERY_SECRET = "  long-random-recovery-secret  ";
    expect(isRecoveryEnabled()).toBe(true);
    expect(recoverySecret()).toBe("long-random-recovery-secret");
    expect(recoverySecretMatches("long-random-recovery-secret")).toBe(true);
    expect(recoverySecretMatches("wrong-secret")).toBe(false);
    expect(recoverySecretMatches("")).toBe(false);
  });
});
