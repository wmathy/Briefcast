"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ForgotPasswordForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!enabled) {
    return (
      <p className="text-sm text-muted">Recovery isn’t enabled.</p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const response = await fetch("/api/auth/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, secret }),
        });
        const data = (await response.json()) as { error?: string };
        setPending(false);
        if (!response.ok) {
          setError(data.error ?? "Something went wrong.");
          return;
        }
        router.push("/library");
        router.refresh();
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Recovery secret</span>
        <input
          type="password"
          autoComplete="off"
          required
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="tap pressable w-full rounded-full bg-accent font-medium text-bg disabled:opacity-60"
      >
        {pending ? "Working…" : "Set new password"}
      </button>
    </form>
  );
}
