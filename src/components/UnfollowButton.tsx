"use client";

import { useRouter } from "next/navigation";

export function UnfollowButton({ showId }: { showId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-muted underline-offset-2 hover:text-danger hover:underline"
      onClick={async () => {
        await fetch(`/api/follows/${showId}`, { method: "DELETE" });
        router.push("/library");
        router.refresh();
      }}
    >
      Unfollow
    </button>
  );
}
