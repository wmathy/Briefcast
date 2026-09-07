type Stopper = () => void;

const stoppers = new Map<string, Stopper>();
let activeEpisodeId: string | null = null;

/** Pause every other in-app recap so Library cards and the episode player share one voice. */
export function claimRecapPlayback(episodeId: string, stop: Stopper): void {
  if (!episodeId) return;
  for (const [id, other] of stoppers) {
    if (id !== episodeId) other();
  }
  stoppers.set(episodeId, stop);
  activeEpisodeId = episodeId;
}

export function releaseRecapPlayback(episodeId: string): void {
  stoppers.delete(episodeId);
  if (activeEpisodeId === episodeId) activeEpisodeId = null;
}

export function activeRecapEpisodeId(): string | null {
  return activeEpisodeId;
}

export function resetRecapPlaybackForTests(): void {
  stoppers.clear();
  activeEpisodeId = null;
}
