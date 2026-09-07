import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { getCurrentUser } from "@/lib/auth";
import { isRecoveryEnabled } from "@/lib/env";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/library");
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-4xl">Forgot password</h1>
      <ForgotPasswordForm enabled={isRecoveryEnabled()} />
      <p className="text-sm text-muted">
        Remembered it?{" "}
        <Link className="tap pressable inline-flex items-center rounded-md text-accent underline" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
