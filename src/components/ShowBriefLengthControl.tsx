"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseBriefLength, type BriefLength } from "@/lib/brief-length";
import { BriefLengthPicker } from "@/components/BriefLengthPicker";

export function ShowBriefLengthControl({
  showId,
  initialLength,
}: {
  showId: string;
  initialLength: BriefLength;
}) {
  const router = useRouter();
  const [length, setLength] = useState<BriefLength>(initialLength);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(next: BriefLength) {
    const previous = length;
    setLength(next);
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/follows/${showId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briefLength: next }),
    });
    const data = (await response.json()) as { error?: string; briefLength?: string };
    setPending(false);
    if (!response.ok) {
      setLength(previous);
      setError(data.error ?? "Could not save brief length.");
      return;
    }
    setLength(parseBriefLength(data.briefLength ?? next));
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-bg-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Brief length</p>
      <BriefLengthPicker value={length} onChange={save} disabled={pending} name={`show-${showId}-length`} />
      <p className="text-sm text-muted">
        Applies the next time you Generate, or when a new episode is auto-briefed. Existing briefs
        are not rewritten until then.
      </p>
      {saved ? <p className="text-sm text-ok">Saved. Generate again to rewrite an existing brief.</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
