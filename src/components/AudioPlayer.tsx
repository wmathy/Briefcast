"use client";

import { PlayPauseGlyph } from "@/components/PlayPauseGlyph";
import { useRecapAudio } from "@/components/useRecapAudio";
import { formatPlayerTime } from "@/lib/format-time";
import { DEFAULT_PLAYBACK_RATE } from "@/lib/player-constants";
import { useState } from "react";

const RATES = [1, DEFAULT_PLAYBACK_RATE] as const;

export function AudioPlayer({
  src,
  episodeId,
  durationHint,
}: {
  src: string;
  episodeId: string;
  durationHint?: number;
}) {
  const { audioRef, audioProps, playing, currentTime, duration, progress, seekingRef, togglePlay, seekTo, setCurrentTime } =
    useRecapAudio({
      episodeId,
      src,
      durationHint,
      preload: "auto",
    });
  const [rate, setRate] = useState(DEFAULT_PLAYBACK_RATE);

  function applyRate(next: number) {
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  return (
    <div className="rounded-2xl border border-line bg-bg-raised px-3 py-3 sm:px-4">
      <audio
        {...audioProps}
        onPlay={(event) => {
          event.currentTarget.playbackRate = rate;
          audioProps.onPlay();
        }}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = rate;
          audioProps.onLoadedMetadata(event);
        }}
      />
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            void togglePlay();
          }}
          aria-label={playing ? "Pause" : "Play"}
          className="tap pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-bg"
        >
          <PlayPauseGlyph playing={playing} />
        </button>

        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
          {formatPlayerTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={duration <= 0}
          aria-label="Seek"
          className="audio-scrubber min-w-0 flex-1"
          style={{ ["--progress" as string]: `${progress * 100}%` }}
          onPointerDown={() => {
            seekingRef.current = true;
          }}
          onPointerUp={(event) => {
            seekTo(Number(event.currentTarget.value));
            seekingRef.current = false;
          }}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            setCurrentTime(next);
            if (!seekingRef.current) seekTo(next);
          }}
        />

        <span className="w-10 shrink-0 text-xs tabular-nums text-muted">
          {formatPlayerTime(duration)}
        </span>

        <button
          type="button"
          title="Speed"
          aria-label={`Playback speed ${rate}x`}
          onClick={() => {
            const index = RATES.indexOf(rate as (typeof RATES)[number]);
            applyRate(RATES[(index + 1) % RATES.length] ?? DEFAULT_PLAYBACK_RATE);
          }}
          className="tap pressable inline-flex w-11 shrink-0 items-center justify-center rounded-full border border-ink/35 bg-bg-card text-xs tabular-nums text-ink"
        >
          {rate === 1 ? "1×" : `${rate}×`}
        </button>
      </div>
    </div>
  );
}
