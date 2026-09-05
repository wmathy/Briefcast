import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/library");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
        Your shows. A brief. A spoken recap.
      </h1>
      <p className="max-w-xl text-lg leading-8 text-muted">
        Follow podcasts you already listen to. New episodes get a written brief and a voice recap.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="tap pressable inline-flex items-center rounded-full bg-accent px-5 font-medium text-bg"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="tap pressable inline-flex items-center rounded-full border border-line px-5"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
