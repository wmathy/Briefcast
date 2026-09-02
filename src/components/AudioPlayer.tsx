"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_PLAYBACK_RATE } from "@/lib/player-constants";

const RATES = [1, 1.2, 1.5, 2];

export function AudioPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [rate, setRate] = useState(DEFAULT_PLAYBACK_RATE);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = DEFAULT_PLAYBACK_RATE;
  }, [src]);

  return (
    <div className="rounded-2xl border border-line bg-bg-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Spoken recap · Eve · listen at {DEFAULT_PLAYBACK_RATE}x (length is at 1x)</p>
        <div className="flex gap-1">
          {RATES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRate(value);
                if (audioRef.current) audioRef.current.playbackRate = value;
              }}
              className={`rounded-full px-2 py-0.5 text-xs ${
                rate === value ? "bg-accent text-bg" : "border border-line text-muted"
              }`}
            >
              {value.toFixed(1)}x
            </button>
          ))}
        </div>
      </div>
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={src}
        className="w-full"
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = DEFAULT_PLAYBACK_RATE;
        }}
        onPlay={(event) => {
          event.currentTarget.playbackRate = rate;
        }}
      >
        Your browser does not support audio playback.
      </audio>
      <p className="mt-2 text-xs text-muted">{title}</p>
    </div>
  );
}
