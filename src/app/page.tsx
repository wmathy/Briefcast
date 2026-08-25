import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/library");

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <p className="text-xs uppercase tracking-[0.22em] text-accent">For friends who miss episodes</p>
      <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
        Your shows. A faithful brief. A spoken recap.
      </h1>
      <p className="max-w-xl text-lg leading-8 text-muted">
        Search the podcasts you already follow. When a new episode lands, Briefcast writes a
        source-grounded brief and reads it in Grok Voice. No catalog we picked for you. No email.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-full bg-accent px-5 py-2.5 font-medium text-bg hover:bg-accent-deep"
        >
          Create an account
        </Link>
        <Link href="/login" className="rounded-full border border-line px-5 py-2.5 hover:border-accent">
          Log in
        </Link>
      </div>
    </div>
  );
}
