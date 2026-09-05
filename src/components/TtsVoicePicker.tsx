"use client";

import type { TtsVoice } from "@/lib/tts-voice";

export function TtsVoicePicker({
  value,
  voices,
  onChange,
  disabled,
  id,
}: {
  value: string;
  voices: TtsVoice[];
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const options = voices.some((voice) => voice.id === value)
    ? voices
    : [{ id: value, name: value }, ...voices];

  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span>Voice</span>
      <select
        id={id}
        aria-label="Voice"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tap min-h-11 rounded-full border border-line bg-bg-card px-3 text-sm text-ink disabled:opacity-60"
      >
        {options.map((voice) => (
          <option key={voice.id} value={voice.id} title={voice.hint}>
            {voice.name}
          </option>
        ))}
      </select>
    </label>
  );
}
