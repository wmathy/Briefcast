import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href={user ? "/library" : "/"}
          className="tap pressable inline-flex items-center rounded-md px-1 font-display text-xl tracking-tight text-ink"
        >
          Briefcast
        </Link>
        {user ? (
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm sm:gap-2">
            <Link className="tap pressable rounded-md px-2.5 text-ink/80" href="/library">
              Library
            </Link>
            <Link className="tap pressable rounded-md px-2.5 text-ink/80" href="/discover">
              Discover
            </Link>
            <span className="hidden max-w-[12rem] truncate sm:inline text-muted">{user.email}</span>
            <LogoutButton />
          </nav>
        ) : (
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link className="tap pressable rounded-md px-2.5 text-ink/80" href="/login">
              Log in
            </Link>
            <Link
              className="tap pressable rounded-full bg-accent px-3 font-medium text-bg"
              href="/signup"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
