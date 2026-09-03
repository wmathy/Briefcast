"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBriefLengthLabel, type BriefLength } from "@/lib/brief-length";
import { FULL_TRANSCRIPT_UNAVAILABLE } from "@/lib/transcript-complete";

export function GenerateButton({
  episodeId,
  hasXaiKey,
  briefLength,
  retryUnavailable,
}: {
  episodeId: string;
  hasXaiKey: boolean;
  briefLength?: BriefLength;
  retryUnavailable?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    hasXaiKey ? null : "Add XAI_API_KEY to generate written briefs and spoken recaps.",
  );
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const response = await fetch(`/api/episodes/${episodeId}/generate`, { method: "POST" });
          const data = (await response.json()) as {
            error?: string;
            message?: string;
            published?: boolean;
          };
          setPending(false);
          if (!response.ok) {
            setError(data.error ?? "Generate failed.");
            return;
          }
          if (data.published === false) {
            setError(data.message ?? data.error ?? FULL_TRANSCRIPT_UNAVAILABLE);
            router.refresh();
            return;
          }
          router.refresh();
        }}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent-deep disabled:opacity-60"
      >
        {pending
          ? "Generating…"
          : retryUnavailable
            ? "Retry full transcript"
            : briefLength
              ? `Generate ${formatBriefLengthLabel(briefLength)}`
              : "Generate brief + voice"}
      </button>
      {retryUnavailable ? (
        <p className="text-xs text-muted">
          A brief is published only from a complete episode transcript. This retries the publisher
          transcript, captions, or Grok STT of the full audio file.
        </p>
      ) : briefLength ? (
        <p className="text-xs text-muted">
          Spoken length is measured at 1x. The player can still default to 1.2× playback.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
