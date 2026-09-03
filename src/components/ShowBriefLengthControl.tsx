"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseBriefLength, type BriefLength } from "@/lib/brief-length";
import { BriefLengthPicker } from "@/components/BriefLengthPicker";
import { TtsVoicePicker } from "@/components/TtsVoicePicker";
import { DEFAULT_TTS_VOICE, parseTtsVoice, type TtsVoice } from "@/lib/tts-voice";

export function ShowBriefLengthControl({
  showId,
  initialLength,
  initialVoice = DEFAULT_TTS_VOICE,
  voices,
}: {
  showId: string;
  initialLength: BriefLength;
  initialVoice?: string;
  voices: TtsVoice[];
}) {
  const router = useRouter();
  const [length, setLength] = useState<BriefLength>(initialLength);
  const [voice, setVoice] = useState(parseTtsVoice(initialVoice));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function patch(body: { briefLength?: BriefLength; ttsVoice?: string }) {
    setPending(true);
    setError(null);
    setSaved(false);
    const response = await fetch(`/api/follows/${showId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as {
      error?: string;
      warning?: string;
      briefLength?: string;
      ttsVoice?: string;
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save.");
      return false;
    }
    if (data.briefLength) setLength(parseBriefLength(data.briefLength));
    if (data.ttsVoice) setVoice(parseTtsVoice(data.ttsVoice));
    if (data.warning) setError(data.warning);
    else setSaved(true);
    router.refresh();
    return true;
  }

  async function saveLength(next: BriefLength) {
    const previous = length;
    setLength(next);
    const ok = await patch({ briefLength: next });
    if (!ok) setLength(previous);
  }

  async function saveVoice(next: string) {
    const previous = voice;
    setVoice(next);
    const ok = await patch({ ttsVoice: next });
    if (!ok) setVoice(previous);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <BriefLengthPicker value={length} onChange={saveLength} disabled={pending} name={`show-${showId}-length`} />
      <TtsVoicePicker
        value={voice}
        voices={voices}
        onChange={saveVoice}
        disabled={pending}
        id={`show-${showId}-voice`}
      />
      {saved ? <p className="text-xs text-ok">Saved</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
