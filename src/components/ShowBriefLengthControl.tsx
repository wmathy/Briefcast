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
      setError(data.error ?? "Could not save.");
      return;
    }
    setLength(parseBriefLength(data.briefLength ?? next));
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <BriefLengthPicker value={length} onChange={save} disabled={pending} name={`show-${showId}-length`} />
      {saved ? <p className="text-xs text-ok">Saved</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
