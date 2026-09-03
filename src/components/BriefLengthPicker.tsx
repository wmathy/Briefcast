"use client";

import { BRIEF_LENGTH_SPECS, BRIEF_LENGTHS, type BriefLength } from "@/lib/brief-length";

export function BriefLengthPicker({
  value,
  onChange,
  disabled,
  name,
  id,
}: {
  value: BriefLength;
  onChange: (value: BriefLength) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Brief length" id={id}>
      {BRIEF_LENGTHS.map((length) => {
        const spec = BRIEF_LENGTH_SPECS[length];
        const selected = value === length;
        return (
          <button
            key={length}
            type="button"
            role="radio"
            name={name}
            title={spec.durationLabel}
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(length)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              selected ? "bg-accent text-bg" : "border border-line text-muted hover:border-accent"
            } disabled:opacity-60`}
          >
            {spec.label}
          </button>
        );
      })}
    </div>
  );
}
