import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href={user ? "/library" : "/"} className="flex items-baseline gap-2">
          <span className="font-display text-xl tracking-tight text-ink">Briefcast</span>
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted sm:inline">
            written + spoken
          </span>
        </Link>
        {user ? (
          <nav className="flex items-center gap-3 text-sm text-muted">
            <Link className="hover:text-ink" href="/library">
              Library
            </Link>
            <Link className="hover:text-ink" href="/discover">
              Discover
            </Link>
            <span className="hidden max-w-[12rem] truncate sm:inline">{user.email}</span>
            <LogoutButton />
          </nav>
        ) : (
          <nav className="flex items-center gap-3 text-sm">
            <Link className="text-muted hover:text-ink" href="/login">
              Log in
            </Link>
            <Link
              className="rounded-full bg-accent px-3 py-1.5 font-medium text-bg hover:bg-accent-deep"
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
