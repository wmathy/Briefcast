import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/library");
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-4xl">Sign up</h1>
      <p className="text-sm text-muted">No email verification.</p>
      <AuthForm mode="signup" />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="text-accent hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
