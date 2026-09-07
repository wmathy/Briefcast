import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/library");
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-4xl">Log in</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-muted">
        <Link className="tap pressable inline-flex items-center rounded-md text-accent underline" href="/forgot-password">
          Forgot password
        </Link>
      </p>
      <p className="text-sm text-muted">
        New here?{" "}
        <Link className="tap pressable inline-flex items-center rounded-md text-accent underline" href="/signup">
          Sign up
        </Link>
      </p>
    </div>
  );
}
