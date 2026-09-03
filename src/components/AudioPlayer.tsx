"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPlayerTime } from "@/lib/format-time";
import { DEFAULT_PLAYBACK_RATE } from "@/lib/player-constants";

const RATES = [1, DEFAULT_PLAYBACK_RATE] as const;

function resolveDuration(reported: number, hint?: number): number {
  const finite = Number.isFinite(reported) && reported > 0;
  if (finite && hint && hint > 0 && reported + 0.25 < hint * 0.55) {
    return hint;
  }
  if (finite) return reported;
  return hint && hint > 0 ? hint : 0;
}

export function AudioPlayer({ src, durationHint }: { src: string; durationHint?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint && durationHint > 0 ? durationHint : 0);
  const [rate, setRate] = useState(DEFAULT_PLAYBACK_RATE);
  const seeking = useRef(false);

  const syncDuration = useCallback(
    (audio: HTMLAudioElement) => {
      const next = resolveDuration(audio.duration, durationHint);
      if (next > 0) setDuration(next);
    },
    [durationHint],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = DEFAULT_PLAYBACK_RATE;
    setPlaying(false);
    setCurrentTime(0);
    setDuration(durationHint && durationHint > 0 ? durationHint : 0);
  }, [src, durationHint]);

  function applyRate(next: number) {
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  function seekTo(next: number) {
    const audio = audioRef.current;
    const limit = duration > 0 ? duration : next;
    const clamped = Math.max(0, Math.min(next, limit));
    setCurrentTime(clamped);
    if (audio && Number.isFinite(clamped)) {
      audio.currentTime = clamped;
    }
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="rounded-2xl border border-line bg-bg-raised px-3 py-3 sm:px-4">
      <audio
        ref={audioRef}
        preload="auto"
        src={src}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = rate;
          syncDuration(event.currentTarget);
        }}
        onDurationChange={(event) => syncDuration(event.currentTarget)}
        onTimeUpdate={(event) => {
          if (!seeking.current) setCurrentTime(event.currentTarget.currentTime);
        }}
        onPlay={(event) => {
          event.currentTarget.playbackRate = rate;
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(duration);
        }}
      />
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg hover:bg-accent-deep"
        >
          {playing ? (
            <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="0.8" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="h-4 w-4 translate-x-px" aria-hidden="true">
              <path d="M4 2.4v11.2L13.2 8 4 2.4Z" fill="currentColor" />
            </svg>
          )}
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
          style={{ ["--progress" as string]: `${progress}%` }}
          onPointerDown={() => {
            seeking.current = true;
          }}
          onPointerUp={(event) => {
            seekTo(Number(event.currentTarget.value));
            seeking.current = false;
          }}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            setCurrentTime(next);
            if (!seeking.current) seekTo(next);
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
          className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted hover:text-ink"
        >
          {rate === 1 ? "1×" : `${rate}×`}
        </button>
      </div>
    </div>
  );
}
