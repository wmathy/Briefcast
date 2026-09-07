"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnfollowButton({ showId }: { showId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      className="tap pressable rounded-full border border-line px-3 text-sm text-ink/80 disabled:opacity-60"
      onClick={async () => {
        setPending(true);
        try {
          await fetch(`/api/follows/${showId}`, { method: "DELETE" });
          router.push("/library");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Unfollowing…" : "Unfollow"}
    </button>
  );
}
