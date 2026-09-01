import { afterEach, describe, expect, it } from "vitest";
import { recoverUserPassword, RECOVERY_NOT_ENABLED } from "./auth";

const originalRecoverySecret = process.env.RECOVERY_SECRET;

afterEach(() => {
  if (originalRecoverySecret === undefined) delete process.env.RECOVERY_SECRET;
  else process.env.RECOVERY_SECRET = originalRecoverySecret;
});

describe("recoverUserPassword validation", () => {
  it("rejects an invalid email before touching the database", async () => {
    process.env.RECOVERY_SECRET = "test-recovery-secret";
    const result = await recoverUserPassword({
      email: "not-an-email",
      password: "newpassword1",
      secret: "test-recovery-secret",
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Enter a valid email address.",
    });
  });

  it("rejects a short password", async () => {
    process.env.RECOVERY_SECRET = "test-recovery-secret";
    const result = await recoverUserPassword({
      email: "owner@example.com",
      password: "short",
      secret: "test-recovery-secret",
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Password must be at least 8 characters.",
    });
  });

  it("explains when RECOVERY_SECRET is unset", async () => {
    delete process.env.RECOVERY_SECRET;
    const result = await recoverUserPassword({
      email: "owner@example.com",
      password: "newpassword1",
      secret: "anything",
    });
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: RECOVERY_NOT_ENABLED,
    });
  });

  it("requires a recovery secret when recovery is enabled", async () => {
    process.env.RECOVERY_SECRET = "test-recovery-secret";
    const result = await recoverUserPassword({
      email: "owner@example.com",
      password: "newpassword1",
      secret: "   ",
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Recovery secret is required.",
    });
  });
});
