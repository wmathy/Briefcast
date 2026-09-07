"use client";

import { PlayPauseGlyph } from "@/components/PlayPauseGlyph";
import { useRecapAudio } from "@/components/useRecapAudio";

const RING_SIZE = 44;
const STROKE = 2.75;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function QueuePlayButton({
  episodeId,
  durationHint,
}: {
  episodeId: string;
  durationHint?: number;
}) {
  const { audioProps, playing, progress, togglePlay } = useRecapAudio({
    episodeId,
    src: `/api/audio/${episodeId}`,
    durationHint,
    preload: "none",
  });
  const offset = CIRCUMFERENCE * (1 - progress);
  const percent = Math.round(progress * 100);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void togglePlay();
      }}
      aria-label={playing ? "Pause recap" : `Play recap, ${percent}% listened`}
      aria-pressed={playing}
      title={playing ? "Pause recap" : `Play recap · ${percent}% listened`}
      className="queue-play tap pressable relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
    >
      <audio {...audioProps} />
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="pointer-events-none absolute inset-0 text-line"
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-bg">
        <PlayPauseGlyph playing={playing} />
      </span>
    </button>
  );
}
