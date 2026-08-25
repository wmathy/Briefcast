"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const response = await fetch(`/api/auth/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
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
          className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Password</span>
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent py-2.5 font-medium text-bg hover:bg-accent-deep disabled:opacity-60"
      >
        {pending ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
