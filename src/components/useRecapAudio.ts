"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type SyntheticEvent } from "react";
import {
  isListenComplete,
  listenProgressPercent,
  readListenProgress,
  subscribeListenProgress,
  writeListenProgress,
} from "@/lib/listen-progress";
import { resolveRecapDuration } from "@/lib/recap-duration";
import { claimRecapPlayback, releaseRecapPlayback } from "@/lib/recap-playback";

export function useRecapAudio({
  episodeId,
  src,
  durationHint,
  preload = "auto",
}: {
  episodeId: string;
  src: string;
  durationHint?: number;
  preload?: "none" | "metadata" | "auto";
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekingRef = useRef(false);
  const lastWrite = useRef(0);
  const persisted = useSyncExternalStore(
    subscribeListenProgress,
    () => readListenProgress(episodeId),
    () => null,
  );
  const [live, setLive] = useState<{
    playing: boolean;
    currentTime: number;
    duration: number;
  } | null>(null);

  const duration =
    live?.duration && live.duration > 0
      ? live.duration
      : persisted && persisted.duration > 0
        ? persisted.duration
        : durationHint && durationHint > 0
          ? durationHint
          : 0;
  const currentTime = live?.currentTime ?? persisted?.currentTime ?? 0;
  const playing = live?.playing ?? false;

  const persist = useCallback(
    (time: number, total: number, force = false) => {
      const now = Date.now();
      if (!force && now - lastWrite.current < 1000) return;
      lastWrite.current = now;
      writeListenProgress(episodeId, time, total);
    },
    [episodeId],
  );

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
  }, []);

  const syncDuration = useCallback(
    (audio: HTMLAudioElement) => resolveRecapDuration(audio.duration, durationHint),
    [durationHint],
  );

  useEffect(() => {
    return () => {
      stop();
      releaseRecapPlayback(episodeId);
    };
  }, [episodeId, stop]);

  const applySavedPosition = useCallback(
    (audio: HTMLAudioElement, total: number) => {
      const saved = readListenProgress(episodeId);
      if (!saved || total <= 0) return;
      if (isListenComplete(saved.currentTime, saved.duration || total)) return;
      const next = Math.min(saved.currentTime, total);
      if (next <= 0) return;
      audio.currentTime = next;
      setLive((current) => ({
        playing: current?.playing ?? false,
        currentTime: next,
        duration: total,
      }));
    },
    [episodeId],
  );

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      const total = duration > 0 ? duration : resolveRecapDuration(audio.duration, durationHint);
      const position = audio.currentTime || currentTime;
      if (isListenComplete(position, total)) {
        audio.currentTime = 0;
        setLive({ playing: false, currentTime: 0, duration: total });
      }
      claimRecapPlayback(episodeId, stop);
      try {
        await audio.play();
      } catch {
        setLive((current) => ({
          playing: false,
          currentTime: current?.currentTime ?? currentTime,
          duration: current?.duration ?? total,
        }));
        releaseRecapPlayback(episodeId);
      }
    } else {
      audio.pause();
    }
  }

  function seekTo(next: number) {
    const audio = audioRef.current;
    const limit = duration > 0 ? duration : next;
    const clamped = Math.max(0, Math.min(next, limit));
    setLive((current) => ({
      playing: current?.playing ?? false,
      currentTime: clamped,
      duration: limit,
    }));
    if (audio && Number.isFinite(clamped)) {
      audio.currentTime = clamped;
    }
    persist(clamped, limit, true);
  }

  const audioProps = {
    ref: audioRef,
    preload,
    src,
    onLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;
      const total = syncDuration(audio);
      applySavedPosition(audio, total);
      if (total > 0) {
        setLive((current) => ({
          playing: current?.playing ?? false,
          currentTime: current?.currentTime ?? audio.currentTime,
          duration: total,
        }));
      }
    },
    onDurationChange: (event: SyntheticEvent<HTMLAudioElement>) => {
      const total = syncDuration(event.currentTarget);
      if (total > 0) {
        setLive((current) => ({
          playing: current?.playing ?? false,
          currentTime: current?.currentTime ?? event.currentTarget.currentTime,
          duration: total,
        }));
      }
    },
    onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => {
      if (seekingRef.current) return;
      const audio = event.currentTarget;
      const total = duration > 0 ? duration : audio.duration;
      setLive((current) => ({
        playing: current?.playing ?? !audio.paused,
        currentTime: audio.currentTime,
        duration: total,
      }));
      persist(audio.currentTime, total);
    },
    onPlay: () => {
      setLive((current) => ({
        playing: true,
        currentTime: current?.currentTime ?? currentTime,
        duration: current?.duration ?? duration,
      }));
    },
    onPause: (event: SyntheticEvent<HTMLAudioElement>) => {
      const time = event.currentTarget.currentTime;
      setLive((current) => ({
        playing: false,
        currentTime: time,
        duration: current?.duration ?? duration,
      }));
      persist(time, duration, true);
    },
    onEnded: (event: SyntheticEvent<HTMLAudioElement>) => {
      const total = duration > 0 ? duration : event.currentTarget.duration;
      setLive({ playing: false, currentTime: total, duration: total });
      persist(total, total, true);
    },
  };

  return {
    audioRef,
    audioProps,
    playing,
    currentTime,
    duration,
    progress: listenProgressPercent(currentTime, duration),
    seekingRef,
    togglePlay,
    seekTo,
    setCurrentTime: (next: number) => {
      setLive((current) => ({
        playing: current?.playing ?? false,
        currentTime: next,
        duration: current?.duration ?? duration,
      }));
    },
  };
}
